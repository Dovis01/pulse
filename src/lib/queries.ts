import { pulseConfig } from "@config/pulse.config";
import { composeRuleBasedBrief } from "@/lib/brief/generate";
import { getRepository } from "@/lib/db";
import type { Repository } from "@/lib/db/repository";
import { computeForYouScore } from "@/lib/ranking/relevance";
import { computeTrendSignals, type TrendSignal } from "@/lib/ranking/velocity";
import { localCutoffIso } from "@/lib/time/format";
import type { Article, DailyBrief, StoryCluster, UserInterest } from "@/lib/news/types";

/** Read models consumed by pages — keeps pages free of pipeline logic. */

export interface StoryRowView {
  cluster?: StoryCluster;
  article?: Article;
  rank?: number;
  read: boolean;
  saved: boolean;
  sourceLabel: string;
  sourceCount: number;
}

export interface TodayView {
  briefIntro: string;
  briefSections: { label: string; text: string }[];
  briefModel?: string;
  breaking: StoryCluster[];
  topStories: StoryRowView[];
  forYou: StoryRowView[];
  ai: StoryRowView[];
  world: StoryRowView[];
  openSource: StoryRowView[];
  more: StoryRowView[];
  stats: { sources: number; stories: number; clusters: number; updatedAt?: string };
  whatChanged: { major: number; breaking: number; since: string };
  trending: TrendSignal[];
  live: { sourceName: string; title: string; publishedAt: string; id: string }[];
}

function clusterToRow(
  cluster: StoryCluster,
  readSet: Set<string>,
  savedSet: Set<string>,
  articleIds: string[],
  rank?: number,
): StoryRowView {
  const read = articleIds.some((id) => readSet.has(id));
  const saved = articleIds.some((id) => savedSet.has(id));
  return {
    cluster,
    read,
    saved,
    rank,
    sourceLabel: `${cluster.sourceCount} source${cluster.sourceCount === 1 ? "" : "s"}`,
    sourceCount: cluster.sourceCount,
  };
}

export async function getTodayView(): Promise<TodayView> {
  const repo = await getRepository();
  const now = new Date();
  const since = new Date(now.getTime() - 24 * 3_600_000).toISOString();

  const [clusters, articles, sources, savedSet, runs] = await Promise.all([
    repo.listClusters({ since, orderBy: "importance", limit: 60 }),
    repo.listArticles({ since, limit: 300 }),
    repo.listSources(),
    repo.savedIds(),
    repo.recentRuns(5),
  ]);
  const readIds = await repo.readIds(articles.slice(0, 80).map((a) => a.id));
  const articleIdsByCluster = new Map<string, string[]>();
  for (const a of articles) {
    if (!a.clusterId) continue;
    const list = articleIdsByCluster.get(a.clusterId) ?? [];
    list.push(a.id);
    articleIdsByCluster.set(a.clusterId, list);
  }

  // Brief: prefer today's stored brief; else a cheap rule-based composition.
  const brief = await repo.latestBrief();
  let briefIntro = "";
  let briefSections: { label: string; text: string }[] = [];
  let briefModel: string | undefined;
  if (brief) {
    briefIntro = brief.intro;
    briefSections = brief.sections;
    briefModel = brief.model;
  } else {
    const composed = composeRuleBasedBrief(
      clusters,
      [],
    );
    briefIntro = composed.intro;
    briefSections = composed.sections;
  }

  const breaking = clusters
    .filter((c) => c.isBreaking)
    .sort((a, b) => b.breakingScore - a.breakingScore)
    .slice(0, 3);

  const topClusters = clusters.slice(0, 8);
  const topStories = topClusters.map((c, i) =>
    clusterToRow(c, readIds, savedSet, articleIdsByCluster.get(c.id) ?? [], i + 1),
  );

  // For You: final = importance*0.55 + relevance*0.45 (spec §19).
  const forYou = [...clusters]
    .map((c) => ({ c, final: computeForYouScore(c.importanceScore, c.relevanceScore) }))
    .filter(({ c }) => c.relevanceScore >= pulseConfig.scoring.forYouMinRelevance)
    .sort((a, b) => b.final - a.final)
    .slice(0, 6)
    .map(({ c }, i) => clusterToRow(c, readIds, savedSet, articleIdsByCluster.get(c.id) ?? [], i + 1));

  const byCategory = (cats: string[], limit: number): StoryRowView[] => {
    const list = clusters.filter((c) => cats.includes(c.category)).slice(0, limit);
    return list.map((c) => clusterToRow(c, readIds, savedSet, articleIdsByCluster.get(c.id) ?? []));
  };

  const usedIds = new Set([...topClusters.map((c) => c.id)]);
  const more = clusters
    .filter((c) => !usedIds.has(c.id))
    .slice(0, 5)
    .map((c) => clusterToRow(c, readIds, savedSet, articleIdsByCluster.get(c.id) ?? []));

  const trending = computeTrendSignals(articles, now);
  const live = articles
    .slice()
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
    .slice(0, 8)
    .map((a) => ({ sourceName: a.sourceName, title: a.title, publishedAt: a.publishedAt, id: a.id }));

  const morningCutoff = localCutoffIso(8);
  const changedClusters = clusters.filter((c) => c.lastUpdatedAt >= morningCutoff);

  const lastFetch = runs.find((r) => r.finishedAt);

  return {
    briefIntro,
    briefSections,
    briefModel,
    breaking,
    topStories,
    forYou,
    ai: byCategory(["AI", "Technology"], 5),
    world: byCategory(["World"], 4),
    openSource: byCategory(["OpenSource"], 4),
    more,
    stats: {
      sources: sources.filter((s) => s.enabled).length,
      stories: articles.length,
      clusters: clusters.length,
      updatedAt: lastFetch?.finishedAt ?? lastFetch?.startedAt,
    },
    whatChanged: {
      major: changedClusters.filter((c) => c.importanceScore >= 70).length,
      breaking: changedClusters.filter((c) => c.isBreaking).length,
      since: "08:00",
    },
    trending,
    live,
  };
}

export interface FeedView {
  rows: StoryRowView[];
  nextCursor?: string;
}

export async function getFeedView(options: {
  category?: Article["category"];
  provider?: Article["sourceProvider"];
  orderBy?: "published" | "importance";
  limit?: number;
  cursor?: string;
  since?: string;
}): Promise<FeedView> {
  const repo = await getRepository();
  const limit = options.limit ?? 30;
  const articles = await repo.listArticles({ ...options, limit: limit + 1 });
  const hasMore = articles.length > limit;
  const page = articles.slice(0, limit);

  // Batched: one query for all clusters referenced on this page.
  const clusterIds = [...new Set(page.map((a) => a.clusterId).filter((id): id is string => Boolean(id)))];
  const clusterMap = new Map((await repo.getClusters(clusterIds)).map((c) => [c.id, c]));

  const [readSet, savedSet] = await Promise.all([repo.readIds(page.map((a) => a.id)), repo.savedIds()]);
  const rows: StoryRowView[] = page.map((a) => ({
    article: a,
    cluster: a.clusterId ? clusterMap.get(a.clusterId) : undefined,
    read: readSet.has(a.id),
    saved: savedSet.has(a.id),
    sourceLabel: a.sourceName,
    sourceCount: 1,
  }));
  return { rows, nextCursor: hasMore ? page[page.length - 1]?.publishedAt : undefined };
}

export async function getForYouView(limit = 20): Promise<StoryRowView[]> {
  const repo = await getRepository();
  const since = new Date(Date.now() - 24 * 3_600_000).toISOString();
  const [clusters, articles] = await Promise.all([
    repo.listClusters({ since, orderBy: "importance", limit: 60 }),
    repo.listArticles({ since, limit: 400 }),
  ]);
  const [readSet, savedSet] = await Promise.all([
    repo.readIds(articles.map((a) => a.id)),
    repo.savedIds(),
  ]);
  const byCluster = new Map<string, Article[]>();
  for (const a of articles) {
    if (!a.clusterId) continue;
    const list = byCluster.get(a.clusterId) ?? [];
    list.push(a);
    byCluster.set(a.clusterId, list);
  }

  return clusters
    .map((c) => ({ c, final: computeForYouScore(c.importanceScore, c.relevanceScore) }))
    .filter(({ c }) => c.relevanceScore >= pulseConfig.scoring.forYouMinRelevance)
    .sort((a, b) => b.final - a.final)
    .slice(0, limit)
    .map(({ c }, i) => {
      const ids = (byCluster.get(c.id) ?? []).map((a) => a.id);
      return {
        cluster: c,
        read: ids.some((id) => readSet.has(id)),
        saved: ids.some((id) => savedSet.has(id)),
        rank: i + 1,
        sourceLabel: `${c.sourceCount} source${c.sourceCount === 1 ? "" : "s"}`,
        sourceCount: c.sourceCount,
      };
    });
}

export async function getSavedView(): Promise<StoryRowView[]> {
  const repo = await getRepository();
  const saved = await repo.listSaved();
  const savedSet = await repo.savedIds();
  const readIds = await repo.readIds(saved.map((a) => a.id));
  return saved.map((article) => ({
    article,
    read: readIds.has(article.id),
    saved: savedSet.has(article.id),
    sourceLabel: article.sourceName,
    sourceCount: 1,
  }));
}

export async function getBreakingView(limit = 20): Promise<StoryRowView[]> {
  const repo = await getRepository();
  const since = new Date(Date.now() - 24 * 3_600_000).toISOString();
  const [clusters, articles] = await Promise.all([
    repo.listClusters({ since, orderBy: "breaking", limit: limit * 3 }),
    repo.listArticles({ since, limit: 400 }),
  ]);
  const [readSet, savedSet] = await Promise.all([
    repo.readIds(articles.map((a) => a.id)),
    repo.savedIds(),
  ]);
  const byCluster = new Map<string, Article[]>();
  for (const a of articles) {
    if (!a.clusterId) continue;
    const list = byCluster.get(a.clusterId) ?? [];
    list.push(a);
    byCluster.set(a.clusterId, list);
  }

  const out: StoryRowView[] = [];
  for (const c of clusters) {
    if (c.breakingScore <= pulseConfig.scoring.breakingThreshold - 20) continue;
    if (out.length >= limit) break;
    const ids = (byCluster.get(c.id) ?? []).map((a) => a.id);
    out.push({
      cluster: c,
      read: ids.some((id) => readSet.has(id)),
      saved: ids.some((id) => savedSet.has(id)),
      sourceLabel: `${c.sourceCount} source${c.sourceCount === 1 ? "" : "s"}`,
      sourceCount: c.sourceCount,
    });
  }
  return out;
}

export async function getTrendingSignals(): Promise<TrendSignal[]> {
  const repo = await getRepository();
  const since = new Date(Date.now() - 24 * 3_600_000).toISOString();
  const articles = await repo.listArticles({ since, limit: 500 });
  return computeTrendSignals(articles, new Date());
}

export async function getBriefView(): Promise<{ brief: DailyBrief | null; preview: ReturnType<typeof composeRuleBasedBrief> | null; interests: UserInterest[] }> {
  const repo = await getRepository();
  const brief = await repo.latestBrief();
  if (brief) return { brief, preview: null, interests: await repo.getInterests() };
  const since = new Date(Date.now() - 24 * 3_600_000).toISOString();
  const clusters = await repo.listClusters({ since, orderBy: "importance", limit: 12 });
  return {
    brief: null,
    preview: clusters.length > 0 ? composeRuleBasedBrief(clusters, []) : null,
    interests: await repo.getInterests(),
  };
}

export interface StoryPageView {
  cluster: StoryCluster;
  articles: Article[];
  related: StoryCluster[];
}

export async function getStoryView(slug: string): Promise<StoryPageView | null> {
  const repo = await getRepository();
  let cluster = await repo.getCluster(slug);
  if (!cluster) {
    const article = await repo.getArticle(slug);
    if (!article) return null;
    if (article.clusterId) cluster = await repo.getCluster(article.clusterId);
    if (!cluster) {
      // Stand-alone article without a cluster — synthesize a minimal view.
      const since = new Date(Date.now() - 72 * 3_600_000).toISOString();
      const related = await repo.listClusters({ since, category: article.category, limit: 4 });
      return {
        cluster: {
          id: article.id,
          canonicalTitle: article.title,
          slug,
          category: article.category,
          topics: article.topics,
          entities: article.entities,
          countries: article.country ? [article.country] : [],
          summaryShort: article.description,
          summaryFull: undefined,
          whyItMatters: undefined,
          keyPoints: undefined,
          importanceScore: article.importanceScore,
          breakingScore: 0,
          velocityScore: article.velocityScore,
          relevanceScore: article.relevanceScore,
          sourceCount: 1,
          firstSeenAt: article.publishedAt,
          lastUpdatedAt: article.publishedAt,
          isBreaking: false,
        },
        articles: [article],
        related: related.filter((r) => r.id !== article.id).slice(0, 3),
      };
    }
  }
  const [articles, since] = [
    await repo.clusterArticles(cluster.id),
    new Date(Date.now() - 72 * 3_600_000).toISOString(),
  ];
  const related = (await repo.listClusters({ since, category: cluster.category, limit: 5 })).filter(
    (r) => r.id !== cluster!.id,
  );
  return { cluster, articles, related: related.slice(0, 3) };
}

export async function getTimelineView(limit = 60): Promise<Article[]> {
  const repo = await getRepository();
  return repo.listArticles({ limit, orderBy: "published" });
}

/** Sidebar topic slugs → category + term aliases (topic pages). */
const TOPIC_ALIASES: Record<string, { label: string; categories: Article["category"][]; terms: string[] }> = {
  ai: {
    label: "AI",
    categories: ["AI"],
    terms: ["artificial intelligence", "llm", "machine learning", "openai", "anthropic", "nvidia"],
  },
  technology: {
    label: "Technology",
    categories: ["Technology"],
    terms: ["semiconductors", "technology", "cloud"],
  },
  "open-source": {
    label: "Open Source",
    categories: ["OpenSource"],
    terms: ["open source", "github"],
  },
  markets: { label: "Markets", categories: ["Markets"], terms: ["markets", "finance", "fed"] },
  business: { label: "Business", categories: ["Business"], terms: ["business", "regulation"] },
  world: { label: "World", categories: ["World"], terms: ["world", "geopolitics"] },
  science: { label: "Science", categories: ["Science"], terms: ["science", "research", "physics"] },
  cybersecurity: {
    label: "Cybersecurity",
    categories: ["Cybersecurity"],
    terms: ["cybersecurity", "security", "breach"],
  },
};

export async function getTopicView(slug: string): Promise<{
  label: string;
  articles: Article[];
  topEntities: { label: string; current: number }[];
  total: number;
} | null> {
  const repo = await getRepository();
  const raw = decodeURIComponent(slug).replace(/-/g, " ").trim();

  // Canonical sidebar topics match by category + term aliases.
  const alias = TOPIC_ALIASES[slug.toLowerCase()];
  const since = new Date(Date.now() - 7 * 24 * 3_600_000).toISOString();
  let articles: Article[] = [];

  if (alias) {
    const seen = new Set<string>();
    const perCategory = await Promise.all(
      alias.categories.map((category) => repo.listArticles({ category, since, limit: 40 })),
    );
    for (const list of perCategory) {
      for (const a of list) {
        if (!seen.has(a.id)) {
          seen.add(a.id);
          articles.push(a);
        }
      }
    }
    articles.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
    articles = articles.slice(0, 60);
  } else {
    articles = await repo.listArticles({ topic: raw, since, limit: 40 });
  }

  const label = alias?.label ?? raw.replace(/\b\w/g, (c) => c.toUpperCase());
  const byEntity = await repo.topEntities(since, 100);
  const entitySet = new Set(articles.flatMap((a) => a.entities.map((e) => e.toLowerCase())));
  const topEntities = byEntity
    .filter((e) => entitySet.has(e.label.toLowerCase()))
    .slice(0, 8)
    .map((e) => ({ label: e.label, current: e.current }));
  return { label, articles, topEntities, total: articles.length };
}

export async function getSourcesView(): Promise<
  { source: Awaited<ReturnType<Repository["listSources"]>>[number]; lastError?: string }[]
> {
  const repo = await getRepository();
  const [sources, runs] = await Promise.all([repo.listSources(), repo.recentRuns(60)]);
  const lastRunByProvider = new Map<string, string | undefined>();
  for (const run of runs) {
    if (!lastRunByProvider.has(run.provider)) lastRunByProvider.set(run.provider, run.error);
  }
  return sources
    .map((source) => ({ source, lastError: lastRunByProvider.get(source.provider) }))
    .sort((a, b) => a.source.name.localeCompare(b.source.name));
}
