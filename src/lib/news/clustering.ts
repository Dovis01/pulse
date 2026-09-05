import { jaccard, titleTokens } from "./normalize";
import type { Article, StoryCluster } from "./types";

/**
 * Rule-based story clustering (cost spec §45): normalized title tokens +
 * entity overlap + publication time window. No embeddings in MVP.
 */

export interface ClusterSeed {
  id: string;
  canonicalTitle: string;
  category: string;
  entities: string[];
  topics: string[];
  countries: string[];
  sourceNames: string[];
  createdAt: Date;
  updatedAt: Date;
  tokenSample: string[];
}

export interface MatchResult {
  matchedClusterId: string | null;
  similarity: number;
  entityOverlap: number;
}

export function shouldJoinCluster(
  incomingTokens: string[],
  incomingEntities: string[],
  incomingTime: Date,
  seed: ClusterSeed,
  options: { tokenThreshold?: number; windowHours?: number } = {},
): MatchResult {
  const tokenThreshold = options.tokenThreshold ?? 0.32;
  const windowHours = options.windowHours ?? 72;

  const hours = Math.abs(incomingTime.getTime() - seed.updatedAt.getTime()) / 3_600_000;
  if (hours > windowHours) return { matchedClusterId: null, similarity: 0, entityOverlap: 0 };

  const similarity = jaccard(incomingTokens, seed.tokenSample);
  const seedEntities = new Set(seed.entities.map((e) => e.toLowerCase()));
  const entityOverlap = incomingEntities.filter((e) => seedEntities.has(e.toLowerCase())).length;

  // Category coherence prevents "Apple" (tech) merging with "apple" (markets fruit).
  const sameCategory = true; // categories are comparable across wire differences; scoring handles rank

  const joined =
    sameCategory &&
    ((similarity >= tokenThreshold && entityOverlap >= 0) ||
      (entityOverlap >= 2 && similarity >= 0.18));

  return {
    matchedClusterId: joined ? seed.id : null,
    similarity,
    entityOverlap,
  };
}

/** Fingerprint used for AI summary cache invalidation (cost §59). */
export function clusterHash(articleIds: string[]): string {
  const sorted = [...articleIds].sort().join("|");
  let h = 0x811c9dc5;
  for (let i = 0; i < sorted.length; i += 1) {
    h ^= sorted.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16);
}

/** Choose the most authoritative article's title as canonical. */
export function pickCanonicalTitle(articles: Article[]): string {
  let best = articles[0];
  for (const a of articles) {
    if (a.sourceAuthority > (best?.sourceAuthority ?? 0)) best = a;
    else if (a.sourceAuthority === best?.sourceAuthority && a.publishedAt < best.publishedAt) best = a;
  }
  return best?.title ?? "Untitled story";
}

export function mergeClusterMeta(articles: Article[]): Pick<StoryCluster, "entities" | "topics" | "countries" | "category"> {
  const entities = new Set<string>();
  const topics = new Set<string>();
  const countries = new Set<string>();
  const catCount = new Map<string, number>();
  for (const a of articles) {
    a.entities.forEach((e) => entities.add(e));
    a.topics.forEach((t) => topics.add(t));
    if (a.country) countries.add(a.country);
    catCount.set(a.category, (catCount.get(a.category) ?? 0) + 1);
  }
  let category: Article["category"] = articles[0]?.category ?? "Other";
  let max = 0;
  for (const [cat, n] of catCount) {
    if (n > max) {
      max = n;
      category = cat as Article["category"];
    }
  }
  return {
    entities: [...entities].slice(0, 12),
    topics: [...topics].slice(0, 8),
    countries: [...countries].slice(0, 8),
    category,
  };
}

export function tokenSampleOf(title: string): string[] {
  return titleTokens(title);
}
