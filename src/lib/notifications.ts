/**
 * Sends a message to Slack via incoming webhook.
 * If SLACK_WEBHOOK_URL is not set, logs a warning and does not send.
 */
export async function sendSlackNotification(message: string): Promise<void> {
  const url = process.env.SLACK_WEBHOOK_URL;
  if (!url) {
    console.warn("[notifications] SLACK_WEBHOOK_URL not set; skipping Slack notification:", message);
    return;
  }
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: message }),
  });
  if (!res.ok) {
    console.warn("[notifications] Slack webhook failed:", res.status, await res.text());
  }
}
