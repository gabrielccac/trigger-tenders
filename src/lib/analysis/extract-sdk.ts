import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import { generateText } from "ai";
import { google } from "@ai-sdk/google";
import { ExtractionSchemaText, EXTRACTION_PROMPT_TEXT } from "./schema";
import type { ExtractionText } from "./schema";

const MODEL_ID = "gemini-2.0-flash";
const LOCAL_BIDDING_DIR = path.join(
  process.cwd(),
  "output",
  "attachments",
  "41301206000112026"
);

/** Load all PDFs in a bidding directory. Returns { name, buffer } per file. */
async function loadAllPdfsInDir(dir: string): Promise<{ name: string; buffer: Buffer }[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const pdfs: { name: string; buffer: Buffer }[] = [];
  for (const e of entries) {
    if (!e.isFile() || !e.name.toLowerCase().endsWith(".pdf")) continue;
    const full = path.join(dir, e.name);
    const buffer = await fs.readFile(full);
    pdfs.push({ name: e.name, buffer: Buffer.from(buffer) });
  }
  return pdfs;
}

/**
 * Extracts contact and itens from all PDFs in the bidding directory: one call with all docs,
 * prompt asks for JSON (contato + itens), then we parse and validate with Zod.
 * Run standalone: npx tsx src/lib/analysis/extract-sdk.ts
 */
export async function runExtractSdk(options?: { biddingDir?: string }): Promise<{
  contato: ExtractionText["contato"];
  itens: ExtractionText["itens"];
  validadeProposta?: string;
  prazoEntrega?: string;
  anexos: string[];
  usage?: { promptTokens?: number; completionTokens?: number; totalTokens?: number };
}> {
  const dir = options?.biddingDir ?? LOCAL_BIDDING_DIR;
  const pdfs = await loadAllPdfsInDir(dir);
  if (pdfs.length === 0) {
    throw new Error(`No PDFs found in ${dir}`);
  }

  const fileParts = pdfs.map((pdf) => ({
    type: "file" as const,
    data: pdf.buffer,
    mediaType: "application/pdf" as const,
  }));
  const promptWithContext =
    `Documentos anexados (${pdfs.length}): ${pdfs.map((p) => p.name).join(", ")}.\n\n` +
    EXTRACTION_PROMPT_TEXT;

  const { text, usage } = await generateText({
    model: google(MODEL_ID),
    messages: [
      {
        role: "user",
        content: [
          ...fileParts,
          { type: "text" as const, text: promptWithContext },
        ],
      },
    ],
  });

  const raw = text.trim();
  const stripped = raw.replace(/^```json\s*/i, "").replace(/\s*```$/i, "").trim();
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripped);
  } catch (err) {
    throw new Error(`Failed to parse extraction JSON: ${(err as Error).message}. Raw: ${raw.slice(0, 300)}`);
  }
  const single = Array.isArray(parsed) ? parsed[0] : parsed;
  const extracted = ExtractionSchemaText.parse(single);
  const contato = extracted.contato;
  const itens = extracted.itens ?? [];
  const validadeProposta = extracted.validadeProposta;
  const prazoEntrega = extracted.prazoEntrega;
  const anexos = extracted.anexos ?? [];

  const usageOut = usage
    ? {
        promptTokens: "promptTokens" in usage ? (usage as { promptTokens?: number }).promptTokens : (usage as { inputTokens?: number }).inputTokens,
        completionTokens: "completionTokens" in usage ? (usage as { completionTokens?: number }).completionTokens : (usage as { outputTokens?: number }).outputTokens,
        totalTokens: "totalTokens" in usage ? (usage as { totalTokens?: number }).totalTokens : undefined,
      }
    : undefined;

  return { contato, itens, validadeProposta, prazoEntrega, anexos, usage: usageOut };
}

// Run when executed directly (e.g. npx tsx src/lib/analysis/extract-sdk.ts)
const isMain = process.argv[1]?.endsWith("extract-sdk.ts");
if (isMain) {
  runExtractSdk()
    .then(({ contato, itens, validadeProposta, prazoEntrega, anexos, usage }) => {
      console.log("Contato:", JSON.stringify(contato, null, 2));
      console.log("Itens:", JSON.stringify(itens, null, 2));
      console.log("Validade proposta:", validadeProposta);
      console.log("Prazo entrega:", prazoEntrega);
      console.log("Anexos:", anexos);
      console.log("Usage:", usage);
    })
    .catch(console.error);
}
