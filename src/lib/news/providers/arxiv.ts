import type { NewsSource, RawArticle } from "@/lib/news/types";
import { fetchText } from "./fetcher";
import { parseFeed } from "./rss";

/**
 * arXiv adapter (Tier 5, cost spec §23–25). Atom API, recent submissions in
 * AI/CL/LG/DC/CR. Research refreshes slowly — 1–3h cadence upstream.
 */

const CATEGORIES = ["cs.AI", "cs.CL", "cs.LG", "cs.DC", "cs.CR"];

export async function fetchArxiv(source: NewsSource): Promise<RawArticle[]> {
  const query = CATEGORIES.map((c) => `cat:${c}`).join("+OR+");
  const params = new URLSearchParams({
    search_query: query,
    sortBy: "submittedDate",
    sortOrder: "descending",
    max_results: "40",
  });
  const xml = await fetchText(`${source.url}?${params.toString()}`, {
    timeoutMs: 10_000,
    retries: 0,
    label: "arxiv",
  });

  return parseFeed(xml)
    .map((item) => {
      const arxivId = item.externalId?.split("/abs/").pop();
      return {
        externalId: arxivId ? `arxiv-${arxivId}` : undefined,
        url: item.link,
        title: item.title.replace(/\s+/g, " ").trim(),
        description: item.description?.replace(/\s+/g, " ").slice(0, 500),
        publishedAt: item.publishedAt,
        sourceId: source.id,
        sourceName: "arXiv",
        author: item.author,
        language: "en",
        metadata: { kind: "paper", categories: CATEGORIES },
      } satisfies RawArticle;
    })
    .filter((a) => !a.title.toLowerCase().startsWith("error"));
}
