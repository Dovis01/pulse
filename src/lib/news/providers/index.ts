import { fetchArxiv } from "./arxiv";
import { fetchGdelt } from "./gdelt";
import { fetchGithub } from "./github";
import { fetchHuggingFace } from "./huggingface";
import { fetchHackerNews } from "./hackernews";
import { newsApiEnabled, fetchNewsApi } from "./newsapi";
import { fetchRssSource } from "./rss";
import type { NewsSource, ProviderId, RawArticle } from "@/lib/news/types";

export interface SourceOutcome {
  sourceId: string;
  fetched: number;
  error?: string;
  notModified?: boolean;
  conditional?: { etag?: string; lastModified?: string };
}

export interface ProviderFetch {
  provider: ProviderId;
  articles: RawArticle[];
  outcomes: SourceOutcome[];
}

async function fetchSourcesOfProvider(
  provider: ProviderId,
  sources: NewsSource[],
): Promise<ProviderFetch> {
  const articles: RawArticle[] = [];
  const outcomes: SourceOutcome[] = [];

  const runOne = async (source: NewsSource): Promise<void> => {
    try {
      switch (provider) {
        case "rss": {
          const result = await fetchRssSource(source);
          if (result.notModified) {
            outcomes.push({ sourceId: source.id, fetched: 0, notModified: true });
            return;
          }
          articles.push(...result.articles);
          outcomes.push({
            sourceId: source.id,
            fetched: result.articles.length,
            conditional: result.conditional,
          });
          return;
        }
        case "gdelt": {
          const result = await fetchGdelt(source);
          articles.push(...result);
          outcomes.push({ sourceId: source.id, fetched: result.length });
          return;
        }
        case "hackernews": {
          const result = await fetchHackerNews(source);
          articles.push(...result);
          outcomes.push({ sourceId: source.id, fetched: result.length });
          return;
        }
        case "github": {
          const result = await fetchGithub(source);
          articles.push(...result);
          outcomes.push({ sourceId: source.id, fetched: result.length });
          return;
        }
        case "arxiv": {
          const result = await fetchArxiv(source);
          articles.push(...result);
          outcomes.push({ sourceId: source.id, fetched: result.length });
          return;
        }
        case "huggingface": {
          const result = await fetchHuggingFace(source);
          articles.push(...result);
          outcomes.push({ sourceId: source.id, fetched: result.length });
          return;
        }
        case "newsapi": {
          if (!newsApiEnabled()) {
            outcomes.push({ sourceId: source.id, fetched: 0 });
            return;
          }
          const result = await fetchNewsApi(source);
          articles.push(...result);
          outcomes.push({ sourceId: source.id, fetched: result.length });
          return;
        }
        default:
          outcomes.push({ sourceId: source.id, fetched: 0, error: "unknown provider" });
      }
    } catch (error) {
      outcomes.push({
        sourceId: source.id,
        fetched: 0,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };

  // Source isolation: one failing feed never takes down the batch.
  await Promise.allSettled(sources.map(runOne));
  return { provider, articles, outcomes };
}

export async function fetchProviders(
  grouped: Map<ProviderId, NewsSource[]>,
): Promise<ProviderFetch[]> {
  const providers = [...grouped.keys()];
  const results = await Promise.allSettled(
    providers.map((provider) => fetchSourcesOfProvider(provider, grouped.get(provider) ?? [])),
  );
  const out: ProviderFetch[] = [];
  for (let i = 0; i < results.length; i += 1) {
    const result = results[i];
    const provider = providers[i]!;
    const sources = grouped.get(provider) ?? [];
    if (result?.status === "fulfilled") {
      out.push(result.value);
    } else {
      out.push({
        provider,
        articles: [],
        outcomes: sources.map((s) => ({
          sourceId: s.id,
          fetched: 0,
          error: "provider crashed",
        })),
      });
    }
  }
  return out;
}

