import { logger, task, tasks } from "@trigger.dev/sdk/v3";
import { fetchAllPages, filterByKeywords } from "../lib/biddings";
import { codigoCompraFromBidding, filterNewBiddings } from "../lib/db/biddings";
import type { ingestBidding } from "./ingest-bidding";


const DEFAULT_PAGE_SIZE = 1000;

const POSITIVE_KEYWORDS = ["cartucho", "toner", "tinta"];
const NEGATIVE_KEYWORDS = [
  "serviço",
  "manutenção",
  "limpeza",
  "prestação",
  "prestar",
];

/**
 * Pipeline: fetch all pages → filter by keywords. Dedup and details/save to follow.
 */
export const fetchBiddingsPipeline = task({
  id: "fetch-biddings-pipeline",
  run: async () => {
    const all = await fetchAllPages(DEFAULT_PAGE_SIZE);
    logger.log("Fetched all pages", { total: all.length });

    const filtered = filterByKeywords(
      all,
      POSITIVE_KEYWORDS,
      NEGATIVE_KEYWORDS
    );
    logger.log("Filtered by keywords", {
      filtered: filtered.length,
      positive: POSITIVE_KEYWORDS,
      negative: NEGATIVE_KEYWORDS,
      sample: filtered.slice(0, 3).map((b) => ({ objetoCompra: b.objetoCompra?.slice(0, 80) })),
    });

    const newBiddings = await filterNewBiddings(filtered);
    logger.log("After dedup", {
      newCount: newBiddings.length,
      skipped: filtered.length - newBiddings.length,
      sample: newBiddings.slice(0, 3).map((b) => ({
        codigoCompra: codigoCompraFromBidding(b),
        objetoCompra: b.objetoCompra?.slice(0, 80),
      })),
    });

    for (const b of newBiddings) {
      const codigoCompra = codigoCompraFromBidding(b);
      await tasks.trigger<typeof ingestBidding>("ingest-bidding", {
        codigoCompra,
        bidding: b,
      });
    }
    logger.log("Triggered ingest tasks", { count: newBiddings.length });
  },
});

/** Test task: run fetchAllPages + filterByKeywords. Trigger manually to verify both. Payload overrides env keywords when provided. */
export const testFetchAndFilter = task({
  id: "test-fetch-and-filter",
  run: async (payload?: {
    pageSize?: number;
    positiveKeywords?: string[];
    negativeKeywords?: string[];
  }) => {
    const pageSize = payload?.pageSize ?? DEFAULT_PAGE_SIZE;
    const all = await fetchAllPages(pageSize);
    logger.log("Fetch complete", { total: all.length, pageSize });

    const positive = payload?.positiveKeywords ?? POSITIVE_KEYWORDS;
    const negative = payload?.negativeKeywords ?? NEGATIVE_KEYWORDS;
    const filtered = filterByKeywords(all, positive, negative);
    logger.log("Filter complete", {
      filtered: filtered.length,
      positive,
      negative,
      sample: filtered.slice(0, 5).map((b) => ({
        numeroUasg: b.numeroUasg,
        numero: b.numero,
        ano: b.ano,
        objetoCompra: b.objetoCompra?.slice(0, 100),
      })),
    });

    const newBiddings = await filterNewBiddings(filtered);
    logger.log("Dedup complete", {
      newCount: newBiddings.length,
      skipped: filtered.length - newBiddings.length,
      sample: newBiddings.slice(0, 3).map((b) => ({
        codigoCompra: codigoCompraFromBidding(b),
        objetoCompra: b.objetoCompra?.slice(0, 80),
      })),
    });
  },
});
