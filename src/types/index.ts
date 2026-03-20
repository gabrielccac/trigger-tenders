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

/** Response from GET /compras/{codigoCompra} (bidding details). */
export type BiddingDetails = {
  numeroUasg: number;
  modalidade: number;
  numero: number;
  ano: number;
  chaveCompraPncp: string;
  linkPncp: string;
  editalDisponivel: boolean;
  nomeUasg: string;
  ufUasg?: string;
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
  tipoEventoImpeditivoVigente?: string;
  modoDisputa?: string;
  dataHoraInicioPropostas: string;
  dataHoraFimPropostas: string;
  emergencial?: boolean;
  participacaoExclusivaMeEppOuEquiparadas?: boolean;
  objeto: string;
  julgamentoIniciado?: boolean;
  tipoSuspensao?: string;
  configuracao?: { analisePropostasAutomatica?: boolean };
};

/**
 * Single row from GET /compras/{codigoCompra}/itens response array.
 * tipo "I" = item, "G" = group. valorEstimadoTotal present on most; used for Preco sum.
 */
export type BiddingItem = {
  tipo: string;
  numero?: number;
  identificador?: string;
  descricao?: string;
  quantidadeSolicitada?: number;
  valorEstimado?: number;
  valorEstimadoUnitario?: number;
  valorEstimadoTotal?: number;
  tipoItemCatalogo?: string;
  qtdeItensDoGrupo?: number;
  criterioJulgamento?: string;
  criterioValor?: string;
  fase?: string;
  situacao?: string;
  disputaPorValorUnitario?: boolean;
  possuiOrcamentoSigiloso?: boolean;
  homologado?: boolean;
  numeroSessaoJulgHab?: number;
  tipoTratamentoDiferenciadoMeEpp?: string;
  participacaoExclusivaMeEppOuEquiparadas?: boolean;
  utilizaMargemPreferencia?: boolean;
  priorizarAbertura?: boolean;
  julgHabEncerrada?: boolean;
};

/** Response from GET /compras/{codigoCompra}/itens/{itemNumero}/detalhamento. */
export type BiddingItemDetails = BiddingItem & {
  descricaoDetalhada?: string;
  unidadeFornecimento?: string;
  tipoVariacaoMinimaEntreLances?: string;
  variacaoMinimaEntreLances?: number;
};

/**
 * Metadata for one attachment from GET /orgaos/{cnpj}/compras/{ano}/{sequencial}/arquivos.
 */
export type BiddingAttachmentMeta = {
  sequencialDocumento: number;
  titulo: string;
  url?: string;
  tipoDocumentoDescricao?: string;
  dataPublicacaoPncp?: string;
  [key: string]: unknown;
};

/**
 * Downloaded attachment: metadata + raw file buffer + resolved content type.
 */
export type BiddingAttachment = {
  meta: BiddingAttachmentMeta;
  buffer: Buffer;
  contentType: string;
};
