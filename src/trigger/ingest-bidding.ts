import { logger, task } from "@trigger.dev/sdk/v3";
import type { Bidding } from "../types";
import { getBiddingDetails, getBiddingItems } from "../lib/api/public/comprasnet";
import { fetchAllAttachments } from "../lib/api/public/pncp";
import { prepareAttachments } from "../lib/files";
import { getRecordId } from "../lib/db/airtable";
import { uploadAttachment } from "../lib/db/airtable";
import {
  AIRTABLE_TABLE_BIDDINGS,
  createBiddingRecord,
} from "../lib/db/biddings";

const CODIGO_COMPRA_FIELD = "CodigoCompra";
const ANEXOS_FIELD = "Anexos";

export type IngestBiddingPayload = { codigoCompra: string; bidding: Bidding };

/**
 * Idempotent per-bidding ingest: ensure one Airtable record (by CodigoCompra), then upload attachments.
 * Retries on attachment failure do not create duplicate records.
 */
export const ingestBidding = task({
  id: "ingest-bidding",
  run: async (payload: IngestBiddingPayload) => {
    const { codigoCompra, bidding } = payload;

    const details = await getBiddingDetails(codigoCompra);
    const existingId = await getRecordId(
      AIRTABLE_TABLE_BIDDINGS,
      CODIGO_COMPRA_FIELD,
      codigoCompra
    );

    let recordId: string;
    let created: boolean;

    if (existingId === null) {
      const items = await getBiddingItems(codigoCompra);
      const { id } = await createBiddingRecord(bidding, details, items);
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
              await uploadAttachment(recordId, ANEXOS_FIELD, {
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
