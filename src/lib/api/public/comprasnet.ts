import type {
  Bidding,
  BiddingDetails,
  BiddingItem,
  BiddingItemDetails,
  SearchPayload,
} from "../../../types";
import { apiGet, apiGetWithToken } from "../client";

const defaultFilter: SearchPayload = {
  abertasParaParticipacao: true,
  emDisputa: false,
  emSelecaoDeFornecedores: false,
  homologada: false,
  deserta: false,
  preferencialMeEpp: false,
  modalidade: "6",
  criterioJulgamento: "",
  unidadeCompradora: "",
  numeroAnoCompra: "2026",
};

/**
 * Lists one page of biddings (compras). Uses a token internally with retries on empty/204.
 */
export async function listBiddings(
  page: number,
  pageSize = 1000,
  filter: Partial<SearchPayload> = {}
): Promise<Bidding[]> {
  const filtro = encodeURIComponent(
    JSON.stringify({ ...defaultFilter, ...filter })
  );
  return apiGetWithToken<Bidding[]>(
    (token) =>
      `/compras?captcha=${encodeURIComponent(token)}&tamanhoPagina=${pageSize}&pagina=${page}&filtro=${filtro}`,
    { maxRetries: 3 }
  );
}

/**
 * Fetches details for one bidding by codigoCompra.
 * GET /compras/{codigoCompra}?captcha={token}
 */
export async function getBiddingDetails(
  codigoCompra: string
): Promise<BiddingDetails> {
  return apiGetWithToken<BiddingDetails>(
    (token) => `/compras/${codigoCompra}?captcha=${encodeURIComponent(token)}`,
    { maxRetries: 3 }
  );
}

/**
 * Fetches all itens (line items) for one bidding by codigoCompra in a single call.
 * Biddings have at most a few hundred items; pageSize=1000 covers all cases in one request.
 * GET /compras/{codigoCompra}/itens?captcha={token}&tamanhoPagina=1000&pagina=0
 */
export async function getBiddingItems(
  codigoCompra: string
): Promise<BiddingItem[]> {
  const result = await apiGetWithToken<BiddingItem[]>(
    (token) =>
      `/compras/${codigoCompra}/itens?captcha=${encodeURIComponent(token)}&tamanhoPagina=1000&pagina=0`,
    { maxRetries: 3 }
  );
  return Array.isArray(result) ? result : [];
}

/**
 * Fetches itens inside one group row (tipo "G") by its numero.
 * This endpoint is public (no captcha token required).
 * GET /compras/{codigoCompra}/itens/{numeroGrupo}/itens-grupo?tamanhoPagina=1000&pagina=0
 */
export async function getGroupItems(
  codigoCompra: string,
  numeroGrupo: number
): Promise<BiddingItem[]> {
  const result = await apiGet<BiddingItem[]>(
    `/compras/${codigoCompra}/itens/${numeroGrupo}/itens-grupo?tamanhoPagina=1000&pagina=0`
  );
  return Array.isArray(result) ? result : [];
}

/**
 * Fetches detailed information for an item (works for standalone items and group sub-items).
 * Requires captcha token.
 * GET /compras/{codigoCompra}/itens/{numeroItem}/detalhamento?captcha={token}
 */
export async function getItemDetails(
  codigoCompra: string,
  numeroItem: number
): Promise<BiddingItemDetails> {
  return apiGetWithToken<BiddingItemDetails>(
    (token) =>
      `/compras/${codigoCompra}/itens/${numeroItem}/detalhamento?captcha=${encodeURIComponent(token)}`,
    { maxRetries: 3 }
  );
}
