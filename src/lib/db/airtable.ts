const AIRTABLE_BASE_ID =
  process.env.AIRTABLE_BASE_ID ?? "app3ZwUila8cvLYLu";
const AIRTABLE_API_BASE = "https://api.airtable.com/v0";

export type AirtableRecord = {
  id: string;
  fields: Record<string, unknown>;
};

export type ListRecordsResult = {
  records: AirtableRecord[];
  offset?: string;
};

function getApiKey(): string {
  const key = process.env.AIRTABLE_API_KEY;
  if (!key) throw new Error("AIRTABLE_API_KEY not set");
  return key;
}

/**
 * Lists one page of records from an Airtable table.
 * Use offset from the previous response to page.
 */
export async function listRecords(
  tableId: string,
  options: {
    fields?: string[];
    pageSize?: number;
    offset?: string;
  } = {}
): Promise<ListRecordsResult> {
  const params = new URLSearchParams();
  if (options.pageSize != null) params.set("pageSize", String(options.pageSize));
  if (options.offset) params.set("offset", options.offset);
  options.fields?.forEach((f) => params.append("fields[]", f));

  const url = `${AIRTABLE_API_BASE}/${AIRTABLE_BASE_ID}/${tableId}?${params.toString()}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${getApiKey()}` },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Airtable error ${res.status}: ${text}`);
  }

  const data = (await res.json()) as {
    records: AirtableRecord[];
    offset?: string;
  };
  return { records: data.records, offset: data.offset };
}

/**
 * Fetches all pages and returns the values of the given field for every record.
 * Used for dedup (e.g. all CodigoCompra values in the table).
 */
export async function listAllValuesForField(
  tableId: string,
  fieldName: string
): Promise<string[]> {
  const values: string[] = [];
  let offset: string | undefined;

  do {
    const { records, offset: nextOffset } = await listRecords(tableId, {
      fields: [fieldName],
      pageSize: 100,
      offset,
    });
    for (const r of records) {
      const v = r.fields[fieldName];
      if (v !== undefined && v !== null) values.push(String(v));
    }
    offset = nextOffset;
  } while (offset);

  return values;
}

/**
 * Returns the record id of the first record where the given field equals the value, or null if none.
 * Uses filterByFormula; value is escaped so single quotes do not break the formula.
 */
export async function getRecordId(
  tableId: string,
  fieldName: string,
  value: string
): Promise<string | null> {
  const escaped = value.replace(/'/g, "''");
  const formula = encodeURIComponent(`{${fieldName}} = '${escaped}'`);
  const url = `${AIRTABLE_API_BASE}/${AIRTABLE_BASE_ID}/${tableId}?filterByFormula=${formula}&pageSize=1&fields[]=${encodeURIComponent(fieldName)}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${getApiKey()}` },
  });
  if (!res.ok) {
    throw new Error(`Airtable getRecordId error ${res.status}: ${await res.text()}`);
  }
  const data = (await res.json()) as { records: AirtableRecord[] };
  return data.records[0]?.id ?? null;
}

/**
 * Creates a single record in an Airtable table.
 * POST to https://api.airtable.com/v0/{baseId}/{tableId} with body { fields }.
 */
export async function createRecord(
  tableId: string,
  fields: Record<string, unknown>
): Promise<AirtableRecord> {
  const url = `${AIRTABLE_API_BASE}/${AIRTABLE_BASE_ID}/${tableId}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getApiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ fields }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Airtable createRecord error ${res.status}: ${text}`);
  }

  const data = (await res.json()) as AirtableRecord;
  return data;
}

const AIRTABLE_CONTENT_BASE = "https://content.airtable.com/v0";

/**
 * Uploads a single file to an Airtable record's attachment field (e.g. Anexos).
 * POST to content.airtable.com with base64-encoded file.
 */
export async function uploadAttachment(
  recordId: string,
  fieldName: string,
  payload: { contentType: string; buffer: Buffer; filename: string }
): Promise<void> {
  const baseId =
    process.env.AIRTABLE_BASE_ID ?? "app3ZwUila8cvLYLu";
  const url = `${AIRTABLE_CONTENT_BASE}/${baseId}/${recordId}/${fieldName}/uploadAttachment`;
  const body = JSON.stringify({
    contentType: payload.contentType,
    file: payload.buffer.toString("base64"),
    filename: payload.filename,
  });
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getApiKey()}`,
      "Content-Type": "application/json",
    },
    body,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Airtable uploadAttachment error ${res.status}: ${text}`);
  }
}
