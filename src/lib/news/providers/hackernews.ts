import type { NewsSource, RawArticle } from "@/lib/news/types";
import { fetchJson } from "./fetcher";

/**
 * Hacker News adapter (Tier 4, cost spec §21–22). Top / Best / Show HN only;
 * points + comments kept as metadata for community velocity.
 */

interface HnItem {
  id: number;
  type?: string;
  title?: string;
  url?: string;
  score?: number;
  descendants?: number;
  by?: string;
  time?: number;
  text?: string;
}

const STORY_LIMIT = 12;

export async function fetchHackerNews(source: NewsSource): Promise<RawArticle[]> {
  const base = source.url.replace(/\/$/, "");
  const [topIds, bestIds, showIds] = await Promise.all([
    fetchJson<number[]>(`${base}/topstories.json`, { label: "hn-top", retries: 1 }),
    fetchJson<number[]>(`${base}/beststories.json`, { label: "hn-best", retries: 1 }),
    fetchJson<number[]>(`${base}/showstories.json`, { label: "hn-show", retries: 1 }).catch(() => [] as number[]),
  ]);

  const seen = new Set<number>();
  const ids: { id: number; list: string }[] = [];
  for (const [list, idList] of [
    ["top", topIds],
    ["best", bestIds],
    ["show", showIds],
  ] as const) {
    for (const id of (idList ?? []).slice(0, STORY_LIMIT)) {
      if (!seen.has(id)) {
        seen.add(id);
        ids.push({ id, list });
      }
    }
  }

  const items = await Promise.allSettled(
    ids.map(async ({ id, list }) => {
      const item = await fetchJson<HnItem>(`${base}/item/${id}.json`, { label: "hn-item", retries: 1 });
      return { item, list };
    }),
  );

  const articles: RawArticle[] = [];
  for (const result of items) {
    if (result.status !== "fulfilled") continue;
    const item = result.value.item;
    const title = item?.title;
    if (!item || !title) continue;
    const { list } = result.value;
    const itemUrl = `https://news.ycombinator.com/item?id=${item.id}`;
    articles.push({
      externalId: `hn-${item.id}`,
      url: item.url ?? itemUrl,
      title,
      description: item.text?.replace(/<[^>]+>/g, " ").slice(0, 300),
      publishedAt: item.time ? new Date(item.time * 1000) : new Date(),
      sourceId: source.id,
      sourceName: source.name,
      author: item.by,
      language: "en",
      metadata: {
        points: item.score ?? 0,
        comments: item.descendants ?? 0,
        hnList: list,
        hnItem: itemUrl,
      },
    });
  }
  return articles;
}
