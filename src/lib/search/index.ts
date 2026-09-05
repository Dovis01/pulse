import type { Repository } from "@/lib/db/repository";
import type { Article } from "@/lib/news/types";
import { DEFAULT_SOURCES } from "@/lib/news/registry";

/**
 * Unified search (product spec §37): stories + topics + entities + sources.
 * V1 uses Postgres FTS (cost §64–66); semantic (pgvector) joins in V2 on
 * the same port.
 */

export interface SearchResults {
  stories: Article[];
  topics: { label: string }[];
  entities: { label: string }[];
  sources: { name: string; category: string }[];
}

export async function searchEverything(
  repo: Repository,
  q: string,
  limit = 8,
): Promise<SearchResults> {
  const trimmed = q.trim();
  if (!trimmed) return { stories: [], topics: [], entities: [], sources: [] };

  const stories = await repo.searchArticles(trimmed, limit);
  const lower = trimmed.toLowerCase();

  const [topics, entities] = await Promise.all([
    repo.topTopics(new Date(0).toISOString(), 200),
    repo.topEntities(new Date(0).toISOString(), 200),
  ]);

  return {
    stories,
    topics: topics
      .filter((t) => t.label.toLowerCase().includes(lower))
      .slice(0, 5)
      .map((t) => ({ label: t.label })),
    entities: entities
      .filter((e) => e.label.toLowerCase().includes(lower))
      .slice(0, 5)
      .map((e) => ({ label: e.label })),
    sources: DEFAULT_SOURCES.filter((s) => s.name.toLowerCase().includes(lower))
      .slice(0, 5)
      .map((s) => ({ name: s.name, category: s.category })),
  };
}
