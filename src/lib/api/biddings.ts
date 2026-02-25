import type { Bidding, SearchPayload } from "../../types";
import { apiGetWithToken } from "./client";

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
  numeroAnoCompra: "",
};

/**
 * Lists one page of biddings (compras). Uses a token internally with retries on empty/204.
 */
export async function listBiddings(
  page: number,
  pageSize = 10,
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
