import { logger, task } from "@trigger.dev/sdk/v3";
import type { Bidding } from "../types";
import { getBiddingDetails, getBiddingItems } from "../lib/api/public/comprasnet";
import { fetchAllAttachments } from "../lib/api/public/pncp";
import { prepareAttachments } from "../lib/files";
import { getRecordId } from "../lib/airtable/client";
import { uploadAttachment } from "../lib/airtable/client";
import { createBiddingRecord } from "../lib/airtable/biddings";

const CODIGO_COMPRA_FIELD = "CodigoCompra";
const ANEXOS_FIELD = "Anexos";

/** Max concurrent ingest runs (Airtable + Comprasnet). Override with INGEST_BIDDING_CONCURRENCY. */
function ingestConcurrencyLimit(): number {
  const raw = process.env.INGEST_BIDDING_CONCURRENCY;
  if (raw == null || raw === "") return 5;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1) return 5;
  return Math.min(n, 100);
}

export type IngestBiddingPayload = {
  codigoCompra: string;
  bidding: Bidding;
  baseId: string;
  tableId: string;
};

/**
 * Idempotent per-bidding ingest: ensure one Airtable record (by CodigoCompra), then upload attachments.
 * Retries on attachment failure do not create duplicate records.
 */
export const ingestBidding = task({
  id: "ingest-bidding",
  queue: {
    concurrencyLimit: ingestConcurrencyLimit(),
  },
  run: async (payload: IngestBiddingPayload) => {
    const { codigoCompra, bidding, baseId, tableId } = payload;

    const details = await getBiddingDetails(codigoCompra);
    const existingId = await getRecordId(
      baseId,
      tableId,
      CODIGO_COMPRA_FIELD,
      codigoCompra
    );

    let recordId: string;
    let created: boolean;

    if (existingId === null) {
      const items = await getBiddingItems(codigoCompra);
      const { id } = await createBiddingRecord(
        bidding,
        { baseId, tableId },
        details,
        items
      );
      recordId = id;
      created = true;
    } else {
      recordId = existingId;
      created = false;
    }

    logger.log("Record ensured", { codigoCompra, recordId, created });

    if (details?.linkPncp) {
      try {
        const attachments = await fetchAllAttachments(details.linkPncp);
        if (attachments.length > 0) {
          const pdfs = await prepareAttachments(attachments, {
            log: (msg, data) => logger.log(msg, { codigoCompra, ...data }),
          });
          if (pdfs.length > 0) {
            for (const pdf of pdfs) {
              await uploadAttachment(baseId, recordId, ANEXOS_FIELD, {
                contentType: "application/pdf",
                buffer: pdf.buffer,
                filename: pdf.name,
              });
            }
            logger.log("Attachments uploaded", {
              codigoCompra,
              recordId,
              created,
              count: pdfs.length,
            });
          }
        }
      } catch (attErr) {
        logger.warn("Attachment fetch/prepare/upload failed (non-fatal)", {
          codigoCompra,
          recordId,
          error:
            attErr instanceof Error ? attErr.message : String(attErr),
        });
      }
    }
  },
});
