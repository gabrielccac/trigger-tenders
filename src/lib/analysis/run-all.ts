import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import { runExtractSdk } from "./extract-sdk";
import { runExtractApi } from "./extract-api";

const ATTACHMENTS_DIR = path.join(process.cwd(), "output", "attachments");

type ExtractionResult = {
  biddingId: string;
  approach: "sdk" | "api";
  contato: unknown;
  itens: unknown;
  validadeProposta?: string;
  prazoEntrega?: string;
  anexos?: string[];
  usage: unknown;
  error: string | null;
};

async function runAll(): Promise<void> {
  const entries = await fs.readdir(ATTACHMENTS_DIR, { withFileTypes: true });
  const biddingDirs = entries.filter((e) => e.isDirectory()).map((e) => e.name);
  console.log(`Found ${biddingDirs.length} biddings.`);

  for (const biddingId of biddingDirs) {
    const dir = path.join(ATTACHMENTS_DIR, biddingId);

    console.log(`\n[${biddingId}] Running SDK...`);
    const sdkResult: ExtractionResult = {
      biddingId,
      approach: "sdk",
      contato: null,
      itens: null,
      usage: null,
      error: null,
    };
    try {
      const out = await runExtractSdk({ biddingDir: dir });
      sdkResult.contato = out.contato;
      sdkResult.itens = out.itens;
      sdkResult.validadeProposta = out.validadeProposta;
      sdkResult.prazoEntrega = out.prazoEntrega;
      sdkResult.anexos = out.anexos;
      sdkResult.usage = out.usage;
    } catch (err) {
      sdkResult.error = (err as Error).message;
      console.error(`[${biddingId}] SDK error:`, sdkResult.error);
    }
    await fs.writeFile(
      path.join(dir, "sdk.json"),
      JSON.stringify(sdkResult, null, 2),
      "utf-8"
    );

    console.log(`[${biddingId}] Running API...`);
    const apiResult: ExtractionResult = {
      biddingId,
      approach: "api",
      contato: null,
      itens: null,
      usage: null,
      error: null,
    };
    try {
      const out = await runExtractApi({ biddingDir: dir });
      apiResult.contato = out.contato;
      apiResult.itens = out.itens;
      apiResult.validadeProposta = out.validadeProposta;
      apiResult.prazoEntrega = out.prazoEntrega;
      apiResult.anexos = out.anexos;
      apiResult.usage = out.usage;
    } catch (err) {
      apiResult.error = (err as Error).message;
      console.error(`[${biddingId}] API error:`, apiResult.error);
    }
    await fs.writeFile(
      path.join(dir, "api.json"),
      JSON.stringify(apiResult, null, 2),
      "utf-8"
    );
  }

  console.log("\nDone.");
}

runAll().catch(console.error);
