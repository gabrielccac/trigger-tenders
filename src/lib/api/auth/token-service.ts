import type { TokenResponse } from "../../../types";

/**
 * Fetches a fresh token from the token service (GET {TOKEN_SERVICE_URL}/generate).
 * Set TOKEN_SERVICE_URL in Trigger (or .env) to a reachable URL; localhost only works when the worker runs on your machine.
 * Throws if the response contains an error.
 */
export async function getToken(): Promise<string> {
  const base = (process.env.TOKEN_SERVICE_URL ?? "http://127.0.0.1:8001").trim();
  const url = `${base.replace(/\/$/, "")}/generate`;

  let res: Response;
  try {
    res = await fetch(url);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(
      `Token service fetch failed (${url}). Is TOKEN_SERVICE_URL set and reachable? ${msg}`
    );
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token service ${res.status} ${url}: ${text.slice(0, 500)}`);
  }

  const data = (await res.json()) as TokenResponse;

  if (data.error) {
    throw new Error(`Token error: ${data.error}`);
  }

  return data.token;
}
