import { logger, task } from "@trigger.dev/sdk/v3";
import { listBiddings } from "../lib/api/biddings";

/**
 * Smoke test: fetch page 0 of biddings (token + retries handled inside listBiddings).
 * Trigger manually from the dashboard to verify the full chain.
 */
export const smokeTestBiddings = task({
  id: "smoke-test-biddings",
  run: async () => {
    const biddings = await listBiddings(0);
    logger.log("Biddings fetched", {
      count: biddings.length,
      first: biddings[0] ?? null,
    });
  },
});
