import { logger, task } from "@trigger.dev/sdk/v3";
import { getCustomerByCnpj } from "../lib/airtable/customers";

const AIRTABLE_API = "https://api.airtable.com/v0";

function getApiKey(): string {
  const key = process.env.AIRTABLE_API_KEY;
  if (!key) throw new Error("AIRTABLE_API_KEY not set");
  return key;
}

function headersToObject(res: Response): Record<string, string> {
  const out: Record<string, string> = {};
  res.headers.forEach((v, k) => {
    out[k] = v;
  });
  return out;
}

export type AirtableApiCheckPayload = {
  /**
   * Same as `fetch-biddings-pipeline` payload.cnpj — looks up the customer row (first Airtable call).
   * Falls back to env `AIRTABLE_CHECK_CNPJ` when omitted.
   */
  cnpj?: string;
  /**
   * If true, also GET /v0/meta/bases (needs schema/bases scope on the PAT).
   */
  includeMetaBases?: boolean;
};

/**
 * Runs the same Airtable call as the start of `fetch-biddings-pipeline`: `getCustomerByCnpj`
 * (listRecords on users table with filterByFormula + fields).
 */
export const airtableApiCheck = task({
  id: "airtable-api-check",
  maxDuration: 120,
  run: async (payload: AirtableApiCheckPayload = {}) => {
    const cnpjRaw = payload.cnpj ?? process.env.AIRTABLE_CHECK_CNPJ;
    if (!cnpjRaw?.trim()) {
      throw new Error(
        "Set payload.cnpj or env AIRTABLE_CHECK_CNPJ (same CNPJ you pass to fetch-biddings-pipeline)"
      );
    }

    const customer = await getCustomerByCnpj(cnpjRaw.trim());

    logger.log("getCustomerByCnpj (same as pipeline first Airtable request)", {
      cnpj: customer.cnpj,
      name: customer.name,
      baseId: customer.baseId,
      tableId: customer.tableId,
    });

    let metaBases: {
      ok: boolean;
      status: number;
      basesCount: number | null;
    } | null = null;

    if (payload.includeMetaBases) {
      const key = getApiKey();
      const auth = { Authorization: `Bearer ${key}` } as const;
      const metaUrl = `${AIRTABLE_API}/meta/bases`;
      const metaRes = await fetch(metaUrl, { headers: auth });
      const metaBody = await metaRes.text();
      let basesCount: number | null = null;
      try {
        const metaParsed = JSON.parse(metaBody) as { bases?: unknown[] };
        basesCount = metaParsed.bases?.length ?? null;
      } catch {
        logger.warn("meta/bases response not JSON", {
          status: metaRes.status,
          preview: metaBody.slice(0, 200),
        });
      }

      logger.log("GET /v0/meta/bases (optional)", {
        url: metaUrl,
        status: metaRes.status,
        ok: metaRes.ok,
        headers: headersToObject(metaRes),
        basesCount,
      });

      metaBases = {
        ok: metaRes.ok,
        status: metaRes.status,
        basesCount,
      };
    }

    return {
      ok: true as const,
      validated: "getCustomerByCnpj" as const,
      customer: {
        cnpj: customer.cnpj,
        name: customer.name,
        baseId: customer.baseId,
        tableId: customer.tableId,
        positiveKeywordsCount: customer.positiveKeywords.length,
        negativeKeywordsCount: customer.negativeKeywords.length,
      },
      metaBases,
      note:
        "Matches listRecords(users table) with filterByFormula + fields, same as getCustomerByCnpj in the pipeline.",
    };
  },
});
