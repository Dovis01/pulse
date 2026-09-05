import { pulseConfig } from "@config/pulse.config";
import type { NewsSource, RawArticle } from "@/lib/news/types";
import { fetchJson } from "./fetcher";

/**
 * GDELT DOC 2.0 adapter (Tier 2, cost spec §14–16) — the "global radar".
 * Discovers events gaining multi-country coverage; bodies are not stored.
 */

interface GdeltArticle {
  url?: string;
  title?: string;
  seendate?: string;
  socialimage?: string;
  domain?: string;
  language?: string;
  sourcecountry?: string;
}

interface GdeltResponse {
  articles?: GdeltArticle[];
}

/** GDELT seen dates look like 20260904T124500Z. */
function parseSeenDate(value: string | undefined): Date {
  if (!value) return new Date();
  const match = value.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/);
  if (!match) return new Date();
  const [, y, m, d, h, min, s] = match;
  return new Date(Date.UTC(Number(y), Number(m) - 1, Number(d), Number(h), Number(min), Number(s)));
}

export async function fetchGdelt(source: NewsSource): Promise<RawArticle[]> {
  const params = new URLSearchParams({
    query: pulseConfig.gdelt.query,
    mode: "artlist",
    maxrecords: String(pulseConfig.gdelt.maxRecords),
    timespan: pulseConfig.gdelt.timespan,
    format: "json",
    sort: "datedesc",
  });
  const data = await fetchJson<GdeltResponse>(`${source.url}?${params.toString()}`, {
    timeoutMs: 10_000,
    retries: 0,
    label: "gdelt",
  });

  return (data.articles ?? [])
    .filter((a) => a.url && a.title)
    .map((a) => ({
      externalId: a.url,
      url: a.url!,
      title: a.title!.trim(),
      publishedAt: parseSeenDate(a.seendate),
      sourceId: source.id,
      sourceName: a.domain ?? "GDELT",
      image: a.socialimage,
      language: a.language ?? "en",
      country: a.sourcecountry || undefined,
    }));
}
