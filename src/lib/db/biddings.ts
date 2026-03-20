import type { Bidding, BiddingDetails, BiddingItem } from "../../types";
import { createRecord, listAllValuesForField } from "./airtable";

export const AIRTABLE_TABLE_BIDDINGS =
  process.env.AIRTABLE_TABLE_ID ?? "tbldNqB7CyC0bii06";
const CODIGO_COMPRA_FIELD = "CodigoCompra";

/** Airtable Modalidade select: API modalidade number → option label */
const MODALIDADE_SELECT: Record<number, string> = {
  5: "Pregão Eletrônico",
  6: "Dispensa Eletrônica",
};

function modalidadeToAirtableSelect(modalidade: number): string | undefined {
  return MODALIDADE_SELECT[modalidade];
}

/**
 * Builds the CodigoCompra value for a bidding (padded composite: numeroUasg 6, modalidade 2, numero 5, ano 4).
 * Matches the format stored in Airtable for dedup.
 */
export function codigoCompraFromBidding(b: Bidding): string {
  const uasg = String(b.numeroUasg).padStart(6, "0");
  const mod = String(b.modalidade).padStart(2, "0");
  const num = String(b.numero).padStart(5, "0");
  const ano = String(b.ano).padStart(4, "0");
  return `${uasg}${mod}${num}${ano}`;
}

/**
 * Returns only biddings whose CodigoCompra is not already in the Airtable table.
 * Fetches existing CodigoCompra values from Airtable, then filters.
 */
export async function filterNewBiddings(biddings: Bidding[]): Promise<Bidding[]> {
  const existing = await listAllValuesForField(AIRTABLE_TABLE_BIDDINGS, CODIGO_COMPRA_FIELD);
  const existingSet = new Set(existing);

  return biddings.filter((b) => {
    const codigo = codigoCompraFromBidding(b);
    return !existingSet.has(codigo);
  });
}

/** Airtable field set for a bidding record (no attachments in this phase). */
export type BiddingRecordFields = {
  CodigoCompra: string;
  Descricao?: string;
  Status?: string;
  Modalidade?: string;
  DataLeilao?: string;
  URL?: string;
  Preco?: number;
  UASG?: string;
  Orgao?: string;
  UF?: string;
};

/** Sum of valorEstimadoTotal across all item/group rows. */
export function sumItemsPreco(items: BiddingItem[]): number {
  return items.reduce((s, row) => s + (row.valorEstimadoTotal ?? 0), 0);
}

/**
 * Builds Airtable record fields from list-view Bidding, optional details, and optional items.
 * When details is provided, uses details.objeto (Descricao), details.linkPncp (URL), etc.
 * When items is provided, Preco = sum of all valorEstimadoTotal.
 */
export function buildBiddingRecordFields(
  bidding: Bidding,
  details?: BiddingDetails | null,
  items?: BiddingItem[] | null
): Record<string, unknown> {
  const codigoCompra = codigoCompraFromBidding(bidding);
  const dataLeilao =
    details?.dataHoraFimPropostas ??
    bidding.dataHoraPrevisaoAbertura ??
    bidding.dataHoraFimPropostas ??
    "";

  const modalidadeNum = details?.modalidade ?? bidding.modalidade;
  const modalidadeSelect = modalidadeToAirtableSelect(modalidadeNum);

  const preco =
    items != null && items.length > 0 ? sumItemsPreco(items) : undefined;

  const fields: Record<string, unknown> = {
    CodigoCompra: codigoCompra,
    Descricao: details?.objeto ?? bidding.objetoCompra ?? "",
    Status: "Pendente",
    ...(modalidadeSelect != null && { Modalidade: modalidadeSelect }),
    DataLeilao: dataLeilao || undefined,
    UASG: String(details?.numeroUasg ?? bidding.numeroUasg),
    Orgao: details?.nomeUasg ?? bidding.nomeOrgao ?? "",
    ...(details?.ufUasg != null && details.ufUasg !== "" && { UF: details.ufUasg }),
    ...(preco != null && preco > 0 && { Preco: preco }),
  };

  if (details?.linkPncp) {
    fields.URL = details.linkPncp;
  } else {
    const base =
      process.env.API_BASE_URL ??
      "https://cnetmobile.estaleiro.serpro.gov.br/comprasnet-fase-externa/public/v1";
    fields.URL = `${base}/compras/${codigoCompra}`;
  }
  return fields;
}

/**
 * Creates one Airtable record for the given bidding (details + optional items for Preco; no attachments).
 * When details is provided, uses it to fill Descricao, URL (linkPncp), etc.
 * When items is provided, Preco = sum of valorEstimadoTotal.
 */
export async function createBiddingRecord(
  bidding: Bidding,
  details?: BiddingDetails | null,
  items?: BiddingItem[] | null
): Promise<{ id: string }> {
  const fields = buildBiddingRecordFields(bidding, details, items);
  const record = await createRecord(AIRTABLE_TABLE_BIDDINGS, fields);
  return { id: record.id };
}
