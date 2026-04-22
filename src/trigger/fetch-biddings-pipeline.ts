import { logger, task, tasks } from "@trigger.dev/sdk/v3";
import { codigoCompraFromBidding, fetchAllPages, filterByKeywords } from "../lib/biddings";
import type { Bidding } from "../types";
import { filterNewBiddings } from "../lib/airtable/biddings";
import { getCustomerByCnpj } from "../lib/airtable/customers";
import { getBiddingDetails } from "../lib/api/public/comprasnet";
import type { ingestBidding } from "./ingest-bidding";


const DEFAULT_PAGE_SIZE = 1000;
const BATCH_TRIGGER_MAX_ITEMS = 1000;

/** Pause between each bidding while loading details for UF filter (token + Comprasnet). */
const DETAILS_FILTER_PACE_MS = 300;

/** Log progress at these % thresholds (at most ~5 lines per run). */
const DETAILS_FILTER_LOG_MILESTONES = [20, 40, 60, 80, 100] as const;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export type DetailsFilterError = {
  codigoCompra: string;
  message: string;
};

/**
 * Loads details per bidding and keeps only those whose UASG UF is in allowedUfs (órgão/region).
 * No price filter. Failures on one bidding do not stop the rest.
 */
async function filterByDetailsCriteria(
  biddings: Bidding[],
  options: {
    allowedUfs: string[];
  }
): Promise<{ selected: Bidding[]; errors: DetailsFilterError[] }> {
  const total = biddings.length;

  const normalizedUfs = new Set(
    options.allowedUfs.map((uf) => uf.trim().toUpperCase()).filter(Boolean)
  );
  const selected: Bidding[] = [];
  const errors: DetailsFilterError[] = [];

  for (let i = 0; i < biddings.length; i++) {
    if (DETAILS_FILTER_PACE_MS > 0 && i > 0) {
      await sleep(DETAILS_FILTER_PACE_MS);
    }

    const bidding = biddings[i];
    const codigoCompra = codigoCompraFromBidding(bidding);

    try {
      const details = await getBiddingDetails(codigoCompra);
      const uf = (details.ufUasg ?? "").trim().toUpperCase();

      if (!normalizedUfs.has(uf)) {
        continue;
      }

      selected.push(bidding);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      errors.push({ codigoCompra, message });
    }

    const done = i + 1;
    if (total > 0) {
      const prevPct = Math.floor((i / total) * 100);
      const currPct = Math.floor((done / total) * 100);
      for (const m of DETAILS_FILTER_LOG_MILESTONES) {
        if (prevPct < m && currPct >= m) {
          logger.log(
            `Details filter: ${done}/${total} (${m}%) — ${selected.length} kept, ${errors.length} errors`
          );
        }
      }
    }
  }

  if (errors.length > 0) {
    logger.warn("Details filter: skipped biddings after API/token errors (pipeline continues)", {
      failedCount: errors.length,
      sample: errors.slice(0, 15).map((e) => ({
        codigoCompra: e.codigoCompra,
        message: e.message.slice(0, 200),
      })),
    });
  }

  return { selected, errors };
}

/**
 * Pipeline: fetch all pages → filter by keywords. Dedup and details/save to follow.
 */
export const fetchBiddingsPipeline = task({
  id: "fetch-biddings-pipeline",
  run: async (payload: {
    cnpj: string;
    pageSize?: number;
    allowedUfs: string[];
  }) => {
    const customer = await getCustomerByCnpj(payload.cnpj);
    const pageSize = payload.pageSize ?? DEFAULT_PAGE_SIZE;
    const tableCtx = { baseId: customer.baseId, tableId: customer.tableId };

    const all = await fetchAllPages(pageSize);
    logger.log("Fetched all pages", {
      cnpj: customer.cnpj,
      customerName: customer.name,
      total: all.length,
      pageSize,
    });

    const filtered = filterByKeywords(
      all,
      customer.positiveKeywords,
      customer.negativeKeywords
    );
    logger.log("Filtered by keywords", {
      cnpj: customer.cnpj,
      customerName: customer.name,
      filtered: filtered.length,
      positive: customer.positiveKeywords,
      negative: customer.negativeKeywords,
      sample: filtered.slice(0, 3).map((b) => ({ objetoCompra: b.objetoCompra?.slice(0, 80) })),
    });

    if (DETAILS_FILTER_PACE_MS > 0 && filtered.length > 0) {
      logger.log("Details filter pacing", {
        paceMsBetweenBiddings: DETAILS_FILTER_PACE_MS,
        biddingsToCheck: filtered.length,
      });
    }

    const { selected: filteredByDetails, errors: detailsFilterErrors } =
      await filterByDetailsCriteria(filtered, {
        allowedUfs: payload.allowedUfs,
      });
    logger.log("Filtered by details criteria", {
      cnpj: customer.cnpj,
      customerName: customer.name,
      allowedUfs: payload.allowedUfs,
      filteredByDetails: filteredByDetails.length,
      detailsFilterFailures: detailsFilterErrors.length,
      skippedByDetails: filtered.length - filteredByDetails.length,
      sample: filteredByDetails.slice(0, 3).map((b) => ({
        codigoCompra: codigoCompraFromBidding(b),
        objetoCompra: b.objetoCompra?.slice(0, 80),
      })),
    });

    const newBiddings = await filterNewBiddings(filteredByDetails, tableCtx);
    logger.log("After dedup", {
      cnpj: customer.cnpj,
      customerName: customer.name,
      baseId: customer.baseId,
      tableId: customer.tableId,
      newCount: newBiddings.length,
      skipped: filtered.length - newBiddings.length,
      sample: newBiddings.slice(0, 3).map((b) => ({
        codigoCompra: codigoCompraFromBidding(b),
        objetoCompra: b.objetoCompra?.slice(0, 80),
      })),
    });

    const ingestItems = newBiddings.map((b) => ({
      payload: {
        codigoCompra: codigoCompraFromBidding(b),
        bidding: b,
        baseId: customer.baseId,
        tableId: customer.tableId,
      },
    }));

    for (let i = 0; i < ingestItems.length; i += BATCH_TRIGGER_MAX_ITEMS) {
      const chunk = ingestItems.slice(i, i + BATCH_TRIGGER_MAX_ITEMS);
      await tasks.batchTrigger<typeof ingestBidding>("ingest-bidding", chunk);
    }

    logger.log("Triggered ingest tasks", {
      cnpj: customer.cnpj,
      customerName: customer.name,
      baseId: customer.baseId,
      tableId: customer.tableId,
      count: newBiddings.length,
      batchCount: Math.ceil(ingestItems.length / BATCH_TRIGGER_MAX_ITEMS),
    });
  },
});

/** Test task: run fetchAllPages + filterByKeywords. Trigger manually to verify both. Payload overrides env keywords when provided. */
export const testFetchAndFilter = task({
  id: "test-fetch-and-filter",
  run: async (payload: {
    cnpj: string;
    pageSize?: number;
    positiveKeywords?: string[];
    negativeKeywords?: string[];
    allowedUfs: string[];
  }) => {
    const customer = await getCustomerByCnpj(payload.cnpj);
    const tableCtx = { baseId: customer.baseId, tableId: customer.tableId };
    const pageSize = payload.pageSize ?? DEFAULT_PAGE_SIZE;
    const all = await fetchAllPages(pageSize);
    logger.log("Fetch complete", {
      cnpj: customer.cnpj,
      customerName: customer.name,
      total: all.length,
      pageSize,
    });

    const positive = payload.positiveKeywords ?? customer.positiveKeywords;
    const negative = payload.negativeKeywords ?? customer.negativeKeywords;
    const filtered = filterByKeywords(all, positive, negative);
    logger.log("Filter complete", {
      cnpj: customer.cnpj,
      customerName: customer.name,
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

    const { selected: filteredByDetails, errors: detailsFilterErrors } =
      await filterByDetailsCriteria(filtered, {
        allowedUfs: payload.allowedUfs,
      });
    logger.log("Details filter complete", {
      cnpj: customer.cnpj,
      customerName: customer.name,
      allowedUfs: payload.allowedUfs,
      filteredByDetails: filteredByDetails.length,
      detailsFilterFailures: detailsFilterErrors.length,
      skippedByDetails: filtered.length - filteredByDetails.length,
      sample: filteredByDetails.slice(0, 3).map((b) => ({
        codigoCompra: codigoCompraFromBidding(b),
        objetoCompra: b.objetoCompra?.slice(0, 80),
      })),
    });

    const newBiddings = await filterNewBiddings(filteredByDetails, tableCtx);
    logger.log("Dedup complete", {
      cnpj: customer.cnpj,
      customerName: customer.name,
      baseId: customer.baseId,
      tableId: customer.tableId,
      newCount: newBiddings.length,
      skipped: filtered.length - newBiddings.length,
      sample: newBiddings.slice(0, 3).map((b) => ({
        codigoCompra: codigoCompraFromBidding(b),
        objetoCompra: b.objetoCompra?.slice(0, 80),
      })),
    });
  },
});
