/** Response from token service GET /generate */
export type TokenResponse = {
  token: string;
  duration: number;
  error: string | null;
};

/** Filtro object for the compras search API (JSON-stringified and URL-encoded) */
export type SearchPayload = {
  abertasParaParticipacao: boolean;
  emDisputa: boolean;
  emSelecaoDeFornecedores: boolean;
  homologada: boolean;
  deserta: boolean;
  preferencialMeEpp: boolean;
  modalidade: string;
  criterioJulgamento: string;
  unidadeCompradora: string;
  numeroAnoCompra: string;
};

/** Single item from GET /compras response array */
export type Bidding = {
  numeroUasg: number;
  modalidade: number;
  numero: number;
  ano: number;
  chaveCompraPncp?: string;
  nomeUasg: string;
  caracteristica: string;
  formaRealizacao: string;
  criterioJulgamento: string;
  fundamentoLegal?: string;
  equalizacaoIcms: boolean;
  situacaoCompraFaseExterna: string;
  faseCompraFaseExterna: string;
  homologada: boolean;
  possuiAvisoDeEvento: boolean;
  possuiEventoQueImpedeAcaoNaCompra: boolean;
  objetoCompra: string;
  dataHoraInicioPropostas: string;
  dataHoraFimPropostas: string;
  dataHoraPrevisaoAbertura?: string;
  participacaoExclusivaMeEPP: boolean;
  nomeOrgao: string;
  possuiInformativo: boolean;
};
