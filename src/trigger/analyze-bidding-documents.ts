import path from "node:path";
import { logger, task } from "@trigger.dev/sdk/v3";
import { compareItems } from "../lib/analysis/compare";
import { runExtractSdk } from "../lib/analysis/extract-sdk";
import { sendSlackNotification } from "../lib/notifications";
import { getBiddingItems, getGroupItems } from "../lib/api/public/comprasnet";

const BIDDING_REVIEW_URL_BASE =
  process.env.BIDDING_REVIEW_URL_BASE ??
  "https://cnetmobile.estaleiro.serpro.gov.br/comprasnet-web/public/compras/acompanhamento-compra";

/**
 * Runs extraction on bidding documents, compares with API items, and notifies on mismatch.
 * Payload: { codigoCompra }. No automatic merging; API is authoritative for numbers/prices, docs for specs.
 */
export const analyzeBiddingDocuments = task({
  id: "analyze-bidding-documents",
  run: async (payload: { codigoCompra: string }) => {
    const { codigoCompra } = payload;
    const biddingDir = path.join(process.cwd(), "output", "attachments", codigoCompra);

    const { contato, itens, validadeProposta, prazoEntrega, anexos, usage } =
      await runExtractSdk({ biddingDir });

    const topLevelApiItems = await getBiddingItems(codigoCompra);
    const groupRows = topLevelApiItems.filter(
      (row) => row.tipo === "G" && typeof row.numero === "number"
    );
    const groupSubItems = (
      await Promise.all(
        groupRows.map((g) => getGroupItems(codigoCompra, g.numero as number))
      )
    ).flat();

    // Compare against actual bid items: exclude group headers (tipo "G"), include group sub-items instead.
    const apiItems = [
      ...topLevelApiItems.filter((row) => row.tipo !== "G"),
      ...groupSubItems,
    ];
    logger.log("API items", { apiItems });

    const comparison = compareItems(apiItems, itens);
    logger.log("Comparison result", comparison);

    if (comparison.status === "mismatch") {
      const reviewUrl = `${BIDDING_REVIEW_URL_BASE}?compra=${codigoCompra}`;
      const message = [
        `⚠️ Item mismatch on bidding ${codigoCompra}`,
        comparison.reason,
        `API items: ${comparison.apiItemCount} | Document items: ${comparison.docItemCount}`,
        "",
        "When analyzing/budgeting: use document specs and descriptions.",
        "When registering/submitting the bid: use API item numbers and prices.",
        `Review: ${reviewUrl}`,
      ].join("\n");
      await sendSlackNotification(message);
    }

    logger.log("AI SDK result", {
      contato,
      itens,
      validadeProposta,
      prazoEntrega,
      anexos,
      usage,
    });
  },
});
