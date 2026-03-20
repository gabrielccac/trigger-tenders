import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import { GoogleGenAI } from "@google/genai";
import { ExtractionSchemaStructured, EXTRACTION_PROMPT_STRUCTURED } from "./schema";
import type { ExtractionStructured } from "./schema";

const MODEL_ID = "gemini-2.0-flash";
const LOCAL_BIDDING_DIR = path.join(
  process.cwd(),
  "output",
  "attachments",
  "41301206000112026"
);

let client: GoogleGenAI | null = null;

function getClient(): GoogleGenAI {
  if (!client) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not set");
    }
    client = new GoogleGenAI({ apiKey });
  }
  return client;
}

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
 * JSON + Zod. Run standalone: npx tsx src/lib/analysis/extract-api.ts
 */
export async function runExtractApi(options?: { biddingDir?: string }): Promise<{
  contato: ExtractionStructured["contato"];
  itens: ExtractionStructured["itens"];
  validadeProposta?: string;
  prazoEntrega?: string;
  anexos: string[];
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
  };
}> {
  const ai = getClient();
  const dir = options?.biddingDir ?? LOCAL_BIDDING_DIR;
  const pdfs = await loadAllPdfsInDir(dir);
  if (pdfs.length === 0) {
    throw new Error(`No PDFs found in ${dir}`);
  }

  const promptWithContext =
    `Documentos anexados (${pdfs.length}): ${pdfs.map((p) => p.name).join(", ")}.\n\n` +
    EXTRACTION_PROMPT_STRUCTURED;

  const response = await ai.models.generateContent({
    model: MODEL_ID,
    contents: [
      {
        role: "user",
        parts: [
          ...pdfs.map((pdf) => ({
            inlineData: {
              data: pdf.buffer.toString("base64"),
              mimeType: "application/pdf",
            },
          })),
          { text: promptWithContext },
        ],
      },
    ],
    config: {
      responseMimeType: "application/json",
    },
  });

  const text =
    response.candidates?.[0]?.content?.parts
      ?.map((p) => p.text ?? "")
      .join("")
      .trim() ?? "";

  const usage = response.usageMetadata
    ? {
        inputTokens: response.usageMetadata.promptTokenCount,
        outputTokens: response.usageMetadata.candidatesTokenCount,
        totalTokens: response.usageMetadata.totalTokenCount,
      }
    : undefined;

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    throw new Error(
      `Failed to parse extraction JSON: ${(err as Error).message}. Raw: ${text.slice(0, 200)}`
    );
  }
  const single = Array.isArray(parsed) ? parsed[0] : parsed;
  const extracted = ExtractionSchemaStructured.parse(single);
  const contato = extracted.contato;
  const itens = extracted.itens ?? [];
  const validadeProposta = extracted.validadeProposta;
  const prazoEntrega = extracted.prazoEntrega;
  const anexos = extracted.anexos ?? [];

  return { contato, itens, validadeProposta, prazoEntrega, anexos, usage };
}

// Run when executed directly (e.g. npx tsx src/lib/analysis/extract-api.ts)
const isMain = process.argv[1]?.endsWith("extract-api.ts");
if (isMain) {
  runExtractApi()
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
