import type { TokenResponse } from "../../types";

/**
 * Fetches a fresh token from the token service (GET {TOKEN_SERVICE_URL}/generate).
 * Throws if the response contains an error.
 */
export async function getToken(): Promise<string> {
  const base = process.env.TOKEN_SERVICE_URL ?? "http://localhost:8000";
  const res = await fetch(`${base}/generate`);
  const data: TokenResponse = await res.json();

  if (data.error) {
    throw new Error(`Token error: ${data.error}`);
  }

  return data.token;
}
