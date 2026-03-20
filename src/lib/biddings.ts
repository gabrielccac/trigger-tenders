import { logger } from "@trigger.dev/sdk";
import type { Bidding, SearchPayload } from "../types";
import { listBiddings } from "./api/public/comprasnet";

/**
 * Fetches all pages of biddings. Stops when a page returns fewer items than pageSize.
 * Logs: stable message + structured payload (e.g. { page, itemCount }).
 */
export async function fetchAllPages(
  pageSize = 1000,
  searchFilter: Partial<SearchPayload> = {}
): Promise<Bidding[]> {
  const all: Bidding[] = [];
  let page = 0;

  while (true) {
    const items = await listBiddings(page, pageSize, searchFilter);
    all.push(...items);
    logger.log("Page fetched", { page, itemCount: items.length });
    if (items.length < pageSize) {
      logger.log("Last page reached", { page, totalItems: all.length });
      break;
    }
    page++;
  }

  return all;
}

/**
 * Filters biddings by keywords on objetoCompra.
 * Keeps only items that match at least one positive keyword and none of the negative (case-insensitive).
 */
export function filterByKeywords(
  biddings: Bidding[],
  positiveKeywords: string[],
  negativeKeywords: string[] = []
): Bidding[] {
  const text = (b: Bidding) => (b.objetoCompra ?? "").toLowerCase();
  const pos = positiveKeywords.map((k) => k.toLowerCase().trim()).filter(Boolean);
  const neg = negativeKeywords.map((k) => k.toLowerCase().trim()).filter(Boolean);

  return biddings.filter((b) => {
    const t = text(b);
    const matchesPositive =
      pos.length > 0 && pos.some((k) => t.includes(k));
    const matchesNegative = neg.some((k) => t.includes(k));
    return matchesPositive && !matchesNegative;
  });
}
