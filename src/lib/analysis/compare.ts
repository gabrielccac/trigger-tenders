import type { BiddingItem } from "../../types";
import type { Item } from "./schema";

const TOLERANCE = 0.01;

export type CompareResult =
  | {
      status: "ok";
      apiItemCount: number;
      docItemCount: number;
    }
  | {
      status: "mismatch";
      reason: string;
      apiItemCount: number;
      docItemCount: number;
      apiTotal: number;
      docTotal: number;
    };

/**
 * Compares API items (authoritative for numbers/prices) with document-extracted items (authoritative for specs).
 * No merging. Returns ok when count matches and total prices are within 1%; otherwise mismatch with reason.
 */
export function compareItems(
  apiItems: BiddingItem[],
  docItems: Item[]
): CompareResult {
  const apiItemCount = apiItems.length;
  const docItemCount = docItems.length;

  if (apiItemCount !== docItemCount) {
    return {
      status: "mismatch",
      reason: `API has ${apiItemCount} items, document has ${docItemCount} items`,
      apiItemCount,
      docItemCount,
      apiTotal: sumApiTotal(apiItems),
      docTotal: sumDocTotal(docItems),
    };
  }

  const apiTotal = sumApiTotal(apiItems);
  const docTotal = sumDocTotal(docItems);

  if (docTotal <= 0) {
    return {
      status: "mismatch",
      reason: "Document items have no prices",
      apiItemCount,
      docItemCount,
      apiTotal,
      docTotal,
    };
  }

  if (apiTotal <= 0) {
    return {
      status: "ok",
      apiItemCount,
      docItemCount,
    };
  }

  const ratio = Math.abs(apiTotal - docTotal) / apiTotal;
  if (ratio > TOLERANCE) {
    return {
      status: "mismatch",
      reason: `Totals diverge: API R$ ${apiTotal.toFixed(2)}, document R$ ${docTotal.toFixed(2)}`,
      apiItemCount,
      docItemCount,
      apiTotal,
      docTotal,
    };
  }

  return {
    status: "ok",
    apiItemCount,
    docItemCount,
  };
}

function sumApiTotal(items: BiddingItem[]): number {
  return items.reduce((s, row) => s + (row.valorEstimadoTotal ?? 0), 0);
}

function sumDocTotal(items: Item[]): number {
  return items.reduce((s, item) => s + (item.valorTotal ?? 0), 0);
}
