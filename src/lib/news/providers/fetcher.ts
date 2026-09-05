/**
 * HTTP helper for providers: timeout, retry with exponential backoff,
 * Retry-After awareness (cost spec §99, product spec §71). Never throws
 * past the provider boundary — callers isolate failures per source.
 */

export interface FetchOptions {
  timeoutMs?: number;
  retries?: number;
  headers?: Record<string, string>;
  label?: string;
}

export class FetchError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "FetchError";
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function fetchWithRetry(
  url: string,
  options: FetchOptions = {},
): Promise<Response> {
  const timeoutMs = options.timeoutMs ?? 8_000;
  const retries = options.retries ?? 1;
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: {
          "user-agent": "Pulse/0.1 (personal intelligence feed)",
          ...options.headers,
        },
        signal: AbortSignal.timeout(timeoutMs),
        redirect: "follow",
      });

      if (response.status === 429 || response.status === 503) {
        const retryAfter = Number(response.headers.get("retry-after"));
        if (attempt < retries) {
          await sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 2 ** attempt * 1000);
          continue;
        }
        throw new FetchError(`${options.label ?? url} rate limited`, response.status);
      }
      if (!response.ok) {
        throw new FetchError(`${options.label ?? url} HTTP ${response.status}`, response.status);
      }
      return response;
    } catch (error) {
      lastError = error;
      if (error instanceof FetchError && error.status === 429) throw error;
      if (attempt < retries) {
        await sleep(2 ** attempt * 1000);
        continue;
      }
    }
  }
  throw lastError instanceof Error ? lastError : new FetchError(`fetch failed: ${url}`);
}

export async function fetchText(url: string, options: FetchOptions = {}): Promise<string> {
  const response = await fetchWithRetry(url, options);
  return response.text();
}

export async function fetchJson<T>(url: string, options: FetchOptions = {}): Promise<T> {
  const response = await fetchWithRetry(url, options);
  return (await response.json()) as T;
}
