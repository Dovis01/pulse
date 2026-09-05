import type { NewsSource, RawArticle } from "@/lib/news/types";
import { fetchJson } from "./fetcher";

/**
 * NewsAPI adapter — PAID / dev-tier provider (cost spec §30–31).
 * Implemented for completeness but enabledByDefault=false and hard-gated:
 * the pipeline refuses to call it unless ALLOW_PAID_PROVIDERS=true AND a
 * NEWS_API_KEY exists. Pulse must run without it.
 */

interface NewsApiResponse {
  status?: string;
  articles?: {
    url?: string;
    title?: string;
    description?: string;
    publishedAt?: string;
    author?: string | null;
    urlToImage?: string | null;
    source?: { name?: string };
  }[];
}

export function newsApiEnabled(): boolean {
  return (
    process.env.ALLOW_PAID_PROVIDERS === "true" &&
    Boolean(process.env.NEWS_API_KEY?.trim())
  );
}

export async function fetchNewsApi(source: NewsSource): Promise<RawArticle[]> {
  if (!newsApiEnabled()) return [];
  const params = new URLSearchParams({
    category: "technology",
    language: "en",
    pageSize: "30",
    apiKey: process.env.NEWS_API_KEY!.trim(),
  });
  const data = await fetchJson<NewsApiResponse>(`https://newsapi.org/v2/top-headlines?${params}`, {
    label: "newsapi",
    retries: 1,
  });
  return (data.articles ?? [])
    .filter((a) => a.url && a.title)
    .map((a) => ({
      url: a.url!,
      title: a.title!,
      description: a.description ?? undefined,
      publishedAt: a.publishedAt ? new Date(a.publishedAt) : new Date(),
      sourceId: source.id,
      sourceName: a.source?.name ?? "NewsAPI",
      author: a.author ?? undefined,
      image: a.urlToImage ?? undefined,
      language: "en",
    }));
}
