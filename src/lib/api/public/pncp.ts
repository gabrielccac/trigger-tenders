import type { BiddingAttachment, BiddingAttachmentMeta } from "../../../types";

const PNCP_BASE_URL = "https://pncp.gov.br/api/pncp/v1";

/**
 * Extracts cnpj, ano, sequencial from linkPncp (editais URL).
 * Example: "https://pncp.gov.br/app/editais/46384111000140/2026/000109"
 *   -> { cnpj: "46384111000140", ano: "2026", sequencial: "000109" }
 */
export function parsePncpLink(linkPncp: string): {
  cnpj: string;
  ano: string;
  sequencial: string;
} {
  const segments = linkPncp.replace(/\/+$/, "").split("/").filter(Boolean);
  const sequencial = segments.pop() ?? "";
  const ano = segments.pop() ?? "";
  const cnpj = segments.pop() ?? "";
  return { cnpj, ano, sequencial };
}

/**
 * Returns the total number of attachments for a bidding.
 * GET /orgaos/{cnpj}/compras/{ano}/{sequencial}/arquivos/quantidade
 * No auth required.
 */
export async function getAttachmentCount(linkPncp: string): Promise<number> {
  const { cnpj, ano, sequencial } = parsePncpLink(linkPncp);
  const url = `${PNCP_BASE_URL}/orgaos/${cnpj}/compras/${ano}/${sequencial}/arquivos/quantidade`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`PNCP getAttachmentCount error ${res.status}: ${url}`);
  }
  const count = await res.json();
  return typeof count === "number" ? count : 0;
}

/**
 * Lists attachment metadata for a bidding.
 * GET /orgaos/{cnpj}/compras/{ano}/{sequencial}/arquivos?pagina=1&tamanhoPagina={count}
 * Fetches all in a single request using the known count.
 */
export async function listAttachments(
  linkPncp: string,
  count: number
): Promise<BiddingAttachmentMeta[]> {
  const { cnpj, ano, sequencial } = parsePncpLink(linkPncp);
  const pageSize = Math.max(count, 5);
  const url = `${PNCP_BASE_URL}/orgaos/${cnpj}/compras/${ano}/${sequencial}/arquivos?pagina=1&tamanhoPagina=${pageSize}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`PNCP listAttachments error ${res.status}: ${url}`);
  }
  const data = await res.json();
  return Array.isArray(data) ? (data as BiddingAttachmentMeta[]) : [];
}

/**
 * Downloads one attachment file as a Buffer.
 * Uses meta.url if present; otherwise constructs the URL from linkPncp + sequencialDocumento.
 */
export async function downloadAttachment(
  linkPncp: string,
  meta: BiddingAttachmentMeta
): Promise<BiddingAttachment> {
  const downloadUrl =
    typeof meta.url === "string" && meta.url.startsWith("http")
      ? meta.url
      : (() => {
          const { cnpj, ano, sequencial } = parsePncpLink(linkPncp);
          return `${PNCP_BASE_URL}/orgaos/${cnpj}/compras/${ano}/${sequencial}/arquivos/${meta.sequencialDocumento}`;
        })();

  const res = await fetch(downloadUrl);
  if (!res.ok) {
    throw new Error(
      `PNCP downloadAttachment error ${res.status}: ${downloadUrl}`
    );
  }
  const arrayBuffer = await res.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const contentType =
    res.headers.get("content-type") ?? "application/octet-stream";
  return { meta, buffer, contentType };
}

/**
 * Fetches all attachments for a bidding (count check + list metadata + download each).
 * Returns an empty array if linkPncp is missing or count is 0.
 */
export async function fetchAllAttachments(
  linkPncp: string | undefined | null
): Promise<BiddingAttachment[]> {
  if (!linkPncp) return [];

  const count = await getAttachmentCount(linkPncp);
  if (count === 0) return [];

  const metaList = await listAttachments(linkPncp, count);
  const attachments: BiddingAttachment[] = [];

  for (const meta of metaList) {
    const attachment = await downloadAttachment(linkPncp, meta);
    attachments.push(attachment);
  }

  return attachments;
}
