import { z } from "zod";

/** Normalize CEP to 8 digits only (69075351) or 5+3 with hyphen (69075-351). Strips dots, spaces and other non-digits. */
function normalizeCep(s: string | undefined): string | undefined {
  if (s === undefined) return undefined;
  const digits = s.replace(/\D/g, "");
  if (digits.length !== 8) return undefined;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

/**
 * Structured output for bidding document analysis.
 * Shared between SDK-based and direct-API approaches.
 */
export const DocumentExtractionSchema = z.object({
  itens: z
    .array(
      z.object({
        numero: z.number().optional(),
        descricao: z.string(),
        quantidade: z.number().optional(),
        unidade: z.string().optional(),
        // especificacoes: z.string().optional(),
        valorUnitario: z.number().optional(),
        valorTotal: z.number().optional(),
      })
    )
    .default([]),
  contato: z
    .object({
      nome: z.string().optional(),
      telefone: z.string().optional(),
      email: z.string().optional(),
      endereco: z.string().optional(),
      cep: z.string().optional(),
      municipio: z.string().optional(),
      uf: z.string().optional(),
    })
    .optional(),
  prazoEntrega: z.string().optional(),
  localEntrega: z.string().optional(),
  anexos: z.array(z.string()).optional(),
  // requisitosEspeciais: z.string().optional(),
});

export type DocumentExtraction = z.infer<typeof DocumentExtractionSchema>;

/** Shared phone format: 2 DDD digits + 8 or 9 number digits, no spaces or separators. */
const telefonesSchema = z
  .array(
    z.string().regex(
      /^\d{10,11}$/,
      "DDD (2 dígitos) + número (8 ou 9 dígitos), sem espaços ou separadores"
    )
  )
  .optional()
  .describe(
    "Lista de todos os telefones encontrados. Formato: 2 dígitos DDD + 8 ou 9 dígitos do número, sem espaços ou traços. Ex: 41211827340"
  );

/**
 * Variant A: endereco as structured sub-fields. Use with extract-api.ts for A/B testing.
 */
export const ContatoSchemaStructured = z.object({
  nome: z
    .string()
    .optional()
    .describe("Nome do órgão, setor ou responsável pelo processo de compra"),
  telefones: telefonesSchema,
  email: z
    .string()
    .optional()
    .describe("E-mail de contato da unidade demandante ou do setor responsável"),
  endereco: z
    .object({
      predio: z
        .string()
        .optional()
        .describe("Nome do prédio, sede ou setor, ex: Edifício-Sede, Bloco A"),
      logradouro: z
        .string()
        .optional()
        .describe("Nome da rua, avenida, praça, etc."),
      numero: z.string().optional().describe("Número do imóvel"),
      bairro: z.string().optional().describe("Bairro"),
      complemento: z
        .string()
        .optional()
        .describe("Complemento: sala, andar, bloco, etc."),
    })
    .optional()
    .describe(
      "Endereço de contato ou entrega, extraído diretamente do documento"
    ),
  cep: z
    .string()
    .optional()
    .transform(normalizeCep)
    .describe("CEP somente no formato 8 dígitos: 69075351 ou 69075-351 (apenas números; hífen opcional após o 5º dígito)"),
  municipio: z
    .string()
    .optional()
    .describe("Nome do município/cidade"),
  uf: z
    .string()
    .optional()
    .describe("Sigla do estado (UF), ex: SP, PR, RJ"),
});

export type ContatoStructured = z.infer<typeof ContatoSchemaStructured>;

/**
 * Variant B: endereco as single string with rich description. Use with extract-sdk.ts for A/B testing.
 */
export const ContatoSchemaText = z.object({
  nome: z
    .string()
    .optional()
    .describe("Nome do órgão, setor ou responsável pelo processo de compra"),
  telefones: telefonesSchema,
  email: z
    .string()
    .optional()
    .describe("E-mail de contato da unidade demandante ou do setor responsável"),
  endereco: z
    .string()
    .optional()
    .describe(
      "Endereço completo de contato ou entrega. Inclua, quando presentes: nome do prédio/setor, " +
        "logradouro, número, bairro e complemento. Ex: \"Edifício-Sede, Rua Paulo Ildefonso Assumpção, 92, bairro Bacacheri\""
    ),
  cep: z
    .string()
    .optional()
    .transform(normalizeCep)
    .describe("CEP somente no formato 8 dígitos: 69075351 ou 69075-351 (apenas números; hífen opcional após o 5º dígito)"),
  municipio: z
    .string()
    .optional()
    .describe("Nome do município/cidade"),
  uf: z
    .string()
    .optional()
    .describe("Sigla do estado (UF), ex: SP, PR, RJ"),
});

export type ContatoText = z.infer<typeof ContatoSchemaText>;

/**
 * Single item (bem/serviço) from a bidding document.
 * When multiple descriptions exist for the same item, extraction should use the most complete one.
 */
export const ItemSchema = z.object({
  numero: z
    .coerce
    .number()
    .optional()
    .describe("Número do item no documento (TR/edital), quando houver"),
  descricao: z
    .string()
    .describe(
      "Descrição do item. Se o mesmo item tiver mais de uma descrição nos documentos, use sempre a mais completa (mais detalhada). Não invente."
    ),
  quantidade: z
    .coerce
    .number()
    .optional()
    .describe("Quantidade total planejada, quando informada (número, sem ponto de milhar)"),
  unidade: z
    .string()
    .optional()
    .describe("Unidade de medida: un, cx, kg, etc., se informada"),
  valorUnitario: z
    .coerce
    .number()
    .optional()
    .describe("Valor unitário estimado, apenas se explícito no documento (número, sem símbolo de moeda)"),
  valorTotal: z
    .coerce
    .number()
    .optional()
    .describe("Valor total estimado, apenas se explícito no documento (número, sem símbolo de moeda)"),
});

export type Item = z.infer<typeof ItemSchema>;

/** Full extraction: contato + itens (Variant A — structured endereco). */
export const ExtractionSchemaStructured = z.object({
  contato: ContatoSchemaStructured.optional().nullable().transform((v) => v ?? undefined),
  itens: z.array(ItemSchema).default([]).nullable().transform((v) => v ?? []),
  validadeProposta: z
    .string()
    .optional()
    .nullable()
    .transform((v) => v ?? undefined)
    .describe(
      "Validade da proposta conforme indicado no documento; padrão é 60 dias quando não informado"
    ),
  prazoEntrega: z
    .string()
    .optional()
    .nullable()
    .transform((v) => v ?? undefined)
    .describe("Prazo de entrega dos itens conforme informado no documento"),
  anexos: z
    .array(z.string())
    .default([])
    .nullable()
    .transform((v) => v ?? [])
    .describe(
      "Lista de anexos citados no documento (modelos de declaração, certidões, formulários, etc.)"
    ),
});

export type ExtractionStructured = z.infer<typeof ExtractionSchemaStructured>;

/** Full extraction: contato + itens (Variant B — text endereco). */
export const ExtractionSchemaText = z.object({
  contato: ContatoSchemaText.optional().nullable().transform((v) => v ?? undefined),
  itens: z.array(ItemSchema).default([]).nullable().transform((v) => v ?? []),
  validadeProposta: z
    .string()
    .optional()
    .nullable()
    .transform((v) => v ?? undefined)
    .describe(
      "Validade da proposta conforme indicado no documento; padrão é 60 dias quando não informado"
    ),
  prazoEntrega: z
    .string()
    .optional()
    .nullable()
    .transform((v) => v ?? undefined)
    .describe("Prazo de entrega dos itens conforme informado no documento"),
  anexos: z
    .array(z.string())
    .default([])
    .nullable()
    .transform((v) => v ?? [])
    .describe(
      "Lista de anexos citados no documento (modelos de declaração, certidões, formulários, etc.)"
    ),
});

export type ExtractionText = z.infer<typeof ExtractionSchemaText>;

/** Shared itens section for extraction prompts. */
export const ITENS_FIELD_DESCRIPTIONS = `
- itens: Lista de itens de fornecimento (bens/serviços) encontrados nos documentos. Cada item:
  - numero: número do item no documento, se houver.
  - descricao: texto descritivo do item. Se o mesmo item aparecer com mais de uma descrição (no mesmo documento ou em documentos diferentes), use sempre a descrição mais completa (mais detalhada). Não invente; use apenas o que estiver nos documentos.
  - quantidade: quantidade total, se informada (número, sem ponto de milhar).
  - unidade: unidade de medida (un, cx, kg, etc.), se informada.
  - valorUnitario / valorTotal: apenas se houver estimativa explícita no documento (números, sem símbolo de moeda).
`;

export const EXTRA_FIELD_DESCRIPTIONS = `
- validadeProposta: Validade da proposta, conforme indicado no documento (ex: "60 dias", "90 dias corridos"). Inclua apenas se explícito; o padrão é 60 dias quando não informado.
- prazoEntrega: Prazo para entrega dos itens (ex: "15 dias corridos após emissão da nota de empenho", "10 dias úteis"). Inclua apenas se explícito.
- anexos: Lista de todos os anexos mencionados no documento (modelos de declaração, certidão, formulário, planilha, etc.). Use o nome ou título como aparece no documento.
`;

/** Field descriptions for structured endereco (Variant A — extract-api). */
export const CONTATO_FIELD_DESCRIPTIONS_STRUCTURED = `
- nome: Nome do órgão, setor ou responsável pelo processo de compra.
- telefones: Lista de todos os telefones encontrados. Cada número: 2 dígitos DDD + 8 ou 9 dígitos do número, sem espaços ou traços. Ex: 41211827340. Não invente; inclua apenas os explicitamente presentes.
- email: E-mail de contato da unidade demandante ou do setor responsável.
- cep: CEP da localização (formato 00000-000 ou 00000000). Inclua sempre que estiver explícito no texto ou no endereço.
- municipio: Nome do município/cidade.
- uf: Sigla do estado (UF), ex: SP, PR, RJ.
- endereco: Sub-campos do endereço (omitir os que não aparecerem no documento):
    - localizacao: nome do prédio, sede ou setor.
    - logradouro: rua, avenida, praça, etc.
    - numero: número do imóvel.
    - bairro: bairro.
    - complemento: complemento (sala, andar, etc.).
`;

/** Prompt for Variant A (structured endereco) — contact only. */
export const CONTATO_EXTRACTION_PROMPT_STRUCTURED = `
Extraia do(s) documento(s) anexado(s) as informações de contato da unidade demandante/compradora.

Retorne um único objeto JSON (não uma lista) com exatamente estes campos. Preencha todos os que encontrar no documento; omita apenas os que não aparecerem.

${CONTATO_FIELD_DESCRIPTIONS_STRUCTURED}

Não invente dados; use apenas o que estiver explícito no documento. Para telefones, use apenas dígitos: DDD (2) + número (8 ou 9), sem espaços ou traços. Retorne somente o JSON, sem texto antes ou depois.
`;

/** Full extraction prompt for Variant A (contato + itens, structured endereco). */
export const EXTRACTION_PROMPT_STRUCTURED = `
Extraia do(s) documento(s) anexado(s) as informações de contato e a lista de itens (bens/serviços).

Retorne um único objeto JSON com exatamente cinco chaves: "contato", "itens", "validadeProposta", "prazoEntrega" e "anexos".

contato — objeto com os campos (omitir os que não aparecerem):
${CONTATO_FIELD_DESCRIPTIONS_STRUCTURED}

itens — array de itens encontrados:
${ITENS_FIELD_DESCRIPTIONS}

${EXTRA_FIELD_DESCRIPTIONS}

Regras: Não invente dados; use apenas o que estiver explícito no documento. Inclua o campo "cep" no contato sempre que o CEP aparecer no documento. Para telefones, use apenas dígitos: DDD (2) + número (8 ou 9), sem espaços ou traços. Para itens, se houver várias descrições para o mesmo item, use sempre a mais completa. Números (quantidade, valores) como número, sem ponto de milhar ou símbolo de moeda. Retorne somente o JSON, sem texto antes ou depois.
`;

/** Field descriptions for text endereco (Variant B — extract-sdk). */
export const CONTATO_FIELD_DESCRIPTIONS_TEXT = `
- nome: Nome do órgão, setor ou responsável pelo processo de compra.
- telefones: Lista de todos os telefones encontrados. Cada número: 2 dígitos DDD + 8 ou 9 dígitos do número, sem espaços ou traços. Ex: 41211827340. Não invente; inclua apenas os explicitamente presentes.
- email: E-mail de contato da unidade demandante ou do setor responsável.
- endereco: Endereço completo em texto livre. Inclua, na ordem que aparecer no documento: nome do prédio/setor (se houver), rua/avenida, número, bairro, complemento. Não invente nenhuma parte; inclua apenas o que estiver explícito.
- cep: CEP no formato 00000-000 ou 00000000.
- municipio: Nome do município/cidade.
- uf: Sigla do estado (UF), ex: SP, PR, RJ.
`;

/** Prompt for Variant B (single-string endereco) — contact only. */
export const CONTATO_EXTRACTION_PROMPT_TEXT = `
Extraia do(s) documento(s) anexado(s) as informações de contato da unidade demandante/compradora.

Retorne um único objeto JSON (não uma lista) com exatamente estes campos. Preencha todos os que encontrar no documento; omita apenas os que não aparecerem.

${CONTATO_FIELD_DESCRIPTIONS_TEXT}

Não invente dados; use apenas o que estiver explícito no documento. Para telefones, use apenas dígitos: DDD (2) + número (8 ou 9), sem espaços ou traços. Retorne somente o JSON, sem texto antes ou depois.
`;

/** Full extraction prompt for Variant B (contato + itens, text endereco). */
export const EXTRACTION_PROMPT_TEXT = `
Extraia do(s) documento(s) anexado(s) as informações de contato e a lista de itens (bens/serviços).

Retorne um único objeto JSON com exatamente cinco chaves: "contato", "itens", "validadeProposta", "prazoEntrega" e "anexos".

contato — objeto com os campos (omitir os que não aparecerem):
${CONTATO_FIELD_DESCRIPTIONS_TEXT}

itens — array de itens encontrados:
${ITENS_FIELD_DESCRIPTIONS}

${EXTRA_FIELD_DESCRIPTIONS}

Regras: Não invente dados; use apenas o que estiver explícito no documento. Para telefones, use apenas dígitos: DDD (2) + número (8 ou 9), sem espaços ou traços. Para itens, se houver várias descrições para o mesmo item, use sempre a mais completa. Números (quantidade, valores) como número, sem ponto de milhar ou símbolo de moeda. Retorne somente o JSON, sem texto antes ou depois.
`;

/**
 * Legacy contact schema (single telefone string, single endereco string).
 * Prefer ContatoSchemaStructured or ContatoSchemaText for new code.
 */
export const ContatoSchema = z.object({
  nome: z
    .string()
    .optional()
    .describe("Nome do órgão, setor ou responsável pelo processo de compra"),
  telefone: z
    .string()
    .optional()
    .describe("Telefone(s) de contato da unidade demandante, incluindo DDD"),
  email: z
    .string()
    .optional()
    .describe("E-mail de contato da unidade demandante ou do setor responsável"),
  endereco: z
    .string()
    .optional()
    .describe("Endereço completo especificando, se presente, prédio/setor/sede, logradouro, número e bairro para entrega ou contato"),
  cep: z
    .string()
    .optional()
    .transform(normalizeCep)
    .describe("CEP somente no formato 8 dígitos: 69075351 ou 69075-351 (apenas números; hífen opcional após o 5º dígito)"),
  municipio: z
    .string()
    .optional()
    .describe("Nome do município/cidade"),
  uf: z
    .string()
    .optional()
    .describe("Sigla do estado (UF), ex: SP, PR, RJ"),
});

export type Contato = z.infer<typeof ContatoSchema>;

/**
 * Prompt used for both approaches.
 * Keep it provider-agnostic and focused on the schema fields.
 */
export const EXTRACTION_PROMPT = `
Você é um assistente especializado em análise de documentos de compras públicas brasileiras
(principalmente Termos de Referência, Editais e documentos de Dispensa/ Inexigibilidade).

Sua tarefa é LER COM ATENÇÃO todos os PDFs fornecidos e retornar apenas um objeto JSON
seguindo exatamente o schema fornecido (itens, contato, prazos, indexadores, requisitos).

Instruções:
- Considere todos os anexos em conjunto (vários PDFs podem falar do mesmo processo).
- Quando houver conflito de informação entre documentos, priorize o mais detalhado/recente.
- Quando algum campo não estiver claramente definido, deixe-o ausente (não invente valores).
- Números (quantidade, valores) devem vir como número, sem ponto de milhar ou símbolo de moeda.

Preencha:
- itens: lista com cada item relevante de fornecimento de bens (cartuchos, toners, impressoras, etc.).
  - descricao: texto descritivo do item (em Português, mantendo a terminologia do documento).
  - quantidade: quando houver, a quantidade total planejada.
  - unidade: ex: "un", "cx", "kg", etc., se estiver explícito.
  - especificacoes: requisitos técnicos, marca/modelo sugeridos, compatibilidades, rendimento, etc.
  - valorUnitario / valorTotal: apenas se o documento trouxer estimativa explícita.

- contato: dados da unidade demandante/compradora (quando houver):
  - nome, telefone, email, endereco, cep, municipio, uf.

- prazoEntrega: texto com o(s) prazo(s) de entrega (ex: "até 10 dias úteis após emissão da nota de empenho").
- localEntrega: texto com o local principal de entrega (endereço ou descrição do órgão/setor).
- anexos: lista com nomes dos anexos (ex: "Aviso_e_TR.pdf", "Anexo_1.pdf", "Anexo_2.pdf").
- requisitosEspeciais: texto único resumindo exigências específicas relevantes para o fornecedor
  (ex: obrigação de visita técnica, exigência de assistência técnica autorizada, garantia estendida,
   exigência de marca original, certificações, etc.).

Retorne apenas o JSON, sem comentários ou formatação adicional.
`;

