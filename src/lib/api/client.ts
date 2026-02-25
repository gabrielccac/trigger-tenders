import { getToken } from "../auth/token-service";

const API_BASE_URL =
  process.env.API_BASE_URL ??
  "https://cnetmobile.estaleiro.serpro.gov.br/comprasnet-fase-externa/public/v1";

/**
 * GET request to the wrapped API. Path should start with / (e.g. /compras).
 * Throws on non-2xx. Returns null on 204 No Content or empty/invalid JSON body.
 */
export async function apiGet<T>(path: string): Promise<T | null> {
  const url = path.startsWith("http") ? path : `${API_BASE_URL}${path}`;
  const res = await fetch(url);

  if (!res.ok) {
    throw new Error(`API error ${res.status}: ${path}`);
  }

  if (res.status === 204) {
    return null;
  }

  const text = await res.text();
  if (!text || text.trim() === "") {
    return null;
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

export type ApiGetWithTokenOptions = {
  maxRetries?: number;
};

/**
 * GET with token: gets a fresh token, builds path via pathBuilder(token), calls apiGet.
 * If apiGet returns null (204/empty), fetches a new token and retries up to maxRetries.
 * Throws after max retries exceeded.
 */
export async function apiGetWithToken<T>(
  pathBuilder: (token: string) => string,
  options: ApiGetWithTokenOptions = {}
): Promise<T> {
  const maxRetries = options.maxRetries ?? 3;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const token = await getToken();
    const path = pathBuilder(token);
    const result = await apiGet<T>(path);

    if (result !== null) {
      return result;
    }
  }

  throw new Error(`API returned empty after ${maxRetries} attempts`);
}
