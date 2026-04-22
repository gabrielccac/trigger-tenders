import type { Customer } from "../../types";
import { listRecords } from "./client";

const AIRTABLE_USERS_BASE_ID =
  process.env.AIRTABLE_USERS_BASE_ID ?? "appBzAaTgrRSLctOa";
const AIRTABLE_USERS_TABLE_ID =
  process.env.AIRTABLE_USERS_TABLE_ID ?? "tblJxWO4W7Dsc2eYM";

function asString(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (value == null) return "";
  return String(value).trim();
}

function asKeywordList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((v) => asString(v)).filter(Boolean);
  }
  if (typeof value === "string") {
    return value
      .split(/[\n,;]/)
      .map((v) => v.trim())
      .filter(Boolean);
  }
  return [];
}

export async function getCustomerByCnpj(cnpj: string): Promise<Customer> {
  const normalizedCnpj = cnpj.trim();
  const escaped = normalizedCnpj.replace(/'/g, "''");

  const { records } = await listRecords(AIRTABLE_USERS_BASE_ID, AIRTABLE_USERS_TABLE_ID, {
    fields: [
      "cnpj",
      "name",
      "positiveKeywords",
      "negativeKeywords",
      "baseId",
      "tableId",
    ],
    pageSize: 1,
    filterByFormula: `{cnpj} = '${escaped}'`,
  });

  const record = records[0];
  if (!record) {
    throw new Error(`Customer not found for cnpj: ${normalizedCnpj}`);
  }

  const customer: Customer = {
    cnpj: asString(record.fields.cnpj),
    name: asString(record.fields.name),
    positiveKeywords: asKeywordList(record.fields.positiveKeywords),
    negativeKeywords: asKeywordList(record.fields.negativeKeywords),
    baseId: asString(record.fields.baseId),
    tableId: asString(record.fields.tableId),
  };

  if (!customer.baseId || !customer.tableId) {
    throw new Error(`Customer ${normalizedCnpj} has invalid Airtable destination`);
  }

  return customer;
}
