import { pulseConfig } from "@config/pulse.config";
import { callAI } from "@/lib/ai";
import { getRepository } from "@/lib/db";
import { processBreakingAlerts } from "@/lib/notifications/alerts";
import type { Repository } from "@/lib/db/repository";
import { classifyRules } from "./classify";
import {
  clusterHash,
  mergeClusterMeta,
  pickCanonicalTitle,
  shouldJoinCluster,
  tokenSampleOf,
  type ClusterSeed,
} from "./clustering";
import { dedupe } from "./dedup";
import { articleIdentity, detectLanguage, slugify, titleTokens, truncate } from "./normalize";
import { fetchProviders } from "./providers";
import type { CronGroup, NewsSource, RawArticle, StoryCluster } from "./types";
import { computeBreakingScore } from "@/lib/ranking/breaking";
import { computeImportance, entityImportanceScore } from "@/lib/ranking/importance";
import { computeRelevance } from "@/lib/ranking/relevance";
import { clusterVelocity } from "@/lib/ranking/velocity";
import { storySummaryV1 } from "@prompts";

export interface IngestionSummary {
  fetched: number;
  created: number;
  duplicates: number;
  failed: number;
  clustersUpdated: number;
  summariesGenerated: number;
  alertsSent: number;
  runIds: string[];
}

/** Sources due for refresh inside this cron group (incremental, small). */
export function selectDueSources(sources: NewsSource[], group: CronGroup, now = new Date()): NewsSource[] {
  return sources.filter((s) => {
    if (!s.enabled) return false;
    if (s.provider === "newsapi") {
      return false; // paid provider stays disabled unless separately invoked
    }
    if (s.group !== group) return false;
    if (!s.lastFetchedAt) return true;
    const ageMinutes = (now.getTime() - new Date(s.lastFetchedAt).getTime()) / 60_000;
    return ageMinutes >= s.refreshIntervalMinutes;
  });
}

function normalizeIncoming(
  raw: RawArticle,
  interests: { topic: string; weight: number }[],
  now: Date,
): import("./types").Article {
  const identity = articleIdentity(raw);
  const text = `${raw.title}. ${raw.description ?? ""}`;
  const classified = classifyRules(text);
  const publishedAt = (raw.publishedAt ?? now).toISOString();
  const fetchedAt = now.toISOString();

  return {
    id: crypto.randomUUID(),
    sourceId: raw.sourceId,
    sourceName: raw.sourceName,
    sourceAuthority: 50,
    sourceProvider: "rss",
    externalId: raw.externalId,
    url: raw.url,
    canonicalUrl: identity.canonicalUrl,
    title: raw.title.trim(),
    description: truncate(raw.description, 400),
    content: truncate(raw.content, 600),
    author: raw.author,
    imageUrl: raw.image,
    language: detectLanguage(raw.title, raw.language),
    country: raw.country,
    category: classified.category,
    topics: classified.topics,
    entities: classified.entities,
    tags: [],
    publishedAt,
    fetchedAt,
    importanceScore: 0,
    relevanceScore: computeRelevance({
      title: raw.title,
      description: raw.description,
      topics: classified.topics,
      entities: classified.entities,
      category: classified.category,
      interests,
    }),
    velocityScore: 0,
    metadata: raw.metadata,
  };
}

/**
 * Attach (or create) the story cluster for one article, then recompute the
 * cluster's aggregate scores. Returns the affected cluster.
 */
async function attachToCluster(repo: Repository, article: import("./types").Article, now: Date): Promise<StoryCluster> {
  const windowHours = pulseConfig.scoring.clusterTimeWindowHours;
  const active = await repo.activeClusters(windowHours);
  const seeds: ClusterSeed[] = active.map((c) => ({
    id: c.id,
    canonicalTitle: c.canonicalTitle,
    category: c.category,
    entities: c.entities,
    topics: c.topics,
    countries: c.countries,
    sourceNames: [],
    createdAt: new Date(c.firstSeenAt),
    updatedAt: new Date(c.lastUpdatedAt),
    tokenSample: tokenSampleOf(c.canonicalTitle),
  }));

  const tokens = titleTokens(article.title);
  let matched: ClusterSeed | null = null;
  let bestSimilarity = 0;
  for (const seed of seeds) {
    const result = shouldJoinCluster(
      tokens,
      article.entities,
      new Date(article.publishedAt),
      seed,
      {
        tokenThreshold: pulseConfig.scoring.clusterTokenThreshold,
        windowHours,
      },
    );
    if (result.matchedClusterId && result.similarity >= bestSimilarity) {
      matched = seed;
      bestSimilarity = result.similarity;
    }
  }

  if (matched) {
    await repo.linkArticleCluster(article.id, matched.id);
    article.clusterId = matched.id;
    return await recomputeCluster(repo, matched.id, now);
  }

  // New cluster.
  const id = crypto.randomUUID();
  const cluster: StoryCluster = {
    id,
    canonicalTitle: article.title,
    slug: slugify(article.entities[0] ?? article.category, id),
    category: article.category,
    topics: article.topics,
    entities: article.entities,
    countries: article.country ? [article.country] : [],
    summaryShort: undefined,
    importanceScore: 0,
    breakingScore: 0,
    velocityScore: 0,
    relevanceScore: article.relevanceScore,
    sourceCount: 1,
    firstSeenAt: article.publishedAt,
    lastUpdatedAt: now.toISOString(),
    isBreaking: false,
    clusterHash: clusterHash([article.id]),
  };
  await repo.upsertCluster(cluster);
  await repo.linkArticleCluster(article.id, id);
  article.clusterId = id;
  return await recomputeCluster(repo, id, now);
}

/** Recompute aggregates + scores for a cluster from its articles. */
export async function recomputeCluster(repo: Repository, clusterId: string, now: Date): Promise<StoryCluster> {
  const cluster = await repo.getCluster(clusterId);
  if (!cluster) throw new Error(`cluster ${clusterId} missing`);
  const clusterArticles = await repo.clusterArticles(clusterId);

  const meta = mergeClusterMeta(clusterArticles);
  const firstSeen = clusterArticles.reduce(
    (min, a) => (a.publishedAt < min ? a.publishedAt : min),
    clusterArticles[0]?.publishedAt ?? now.toISOString(),
  );
  const lastUpdated = clusterArticles.reduce(
    (max, a) => (a.publishedAt > max ? a.publishedAt : max),
    clusterArticles[0]?.publishedAt ?? now.toISOString(),
  );
  const distinctSources = new Set(clusterArticles.map((a) => a.sourceId)).size;
  const distinctCountries = new Set(
    clusterArticles.map((a) => a.country).filter((c): c is string => Boolean(c)),
  );
  const velocity = clusterVelocity(clusterArticles, now);
  const hoursSinceUpdate = (now.getTime() - new Date(lastUpdated).getTime()) / 3_600_000;
  const hoursSinceFirst = (now.getTime() - new Date(firstSeen).getTime()) / 3_600_000;

  const importance = computeImportance({
    sourceAuthority: Math.max(...clusterArticles.map((a) => a.sourceAuthority), 40),
    sourceCount: distinctSources,
    velocity,
    entityImportance: entityImportanceScore(meta.entities),
    geoCount: distinctCountries.size,
    hoursSinceUpdate,
  });
  const breaking = computeBreakingScore({
    articlesPerHour: velocity,
    distinctSources,
    maxAuthority: Math.max(...clusterArticles.map((a) => a.sourceAuthority), 40),
    hoursSinceFirstSeen: hoursSinceFirst,
    distinctCountries: distinctCountries.size,
  });

  const updated: StoryCluster = {
    ...cluster,
    canonicalTitle: pickCanonicalTitle(clusterArticles),
    slug: cluster.slug || slugify(meta.entities[0] ?? meta.category, clusterId),
    ...meta,
    importanceScore: importance,
    breakingScore: breaking,
    velocityScore: Math.round(velocity),
    relevanceScore: Math.max(...clusterArticles.map((a) => a.relevanceScore), 0),
    sourceCount: distinctSources,
    firstSeenAt: firstSeen,
    lastUpdatedAt: now.toISOString(),
    isBreaking: breaking > pulseConfig.scoring.breakingThreshold,
    clusterHash: clusterHash(clusterArticles.map((a) => a.id)),
  };
  await repo.upsertCluster(updated);
  return updated;
}

/** AI summarization for one cluster — null-safe, budget-guarded. */
export async function summarizeCluster(repo: Repository, clusterId: string): Promise<boolean> {
  const cluster = await repo.getCluster(clusterId);
  if (!cluster) return false;
  const articles = await repo.clusterArticles(clusterId);
  if (articles.length === 0) return false;

  const hash = clusterHash(articles.map((a) => a.id));
  const unchanged =
    cluster.clusterHash === hash &&
    Boolean(cluster.summaryShort) &&
    cluster.summaryModel != null;
  if (unchanged) return false; // cache hit — DO NOT regenerate (cost §59)

  const aiResult = await callAI((provider) =>
    provider.summarizeCluster({
      canonicalTitle: cluster.canonicalTitle,
      articles: articles.slice(0, 12).map((a) => ({
        title: a.title,
        source: a.sourceName,
        publishedAt: a.publishedAt,
        description: a.description,
      })),
    }),
  );
  if (!aiResult) return false;
  const { result, model } = aiResult;

  cluster.summaryShort = result.summary_short;
  cluster.summaryFull = result.summary_full;
  cluster.whyItMatters = result.why_it_matters;
  cluster.keyPoints = result.key_points;
  cluster.summaryModel = model;
  cluster.summaryVersion = storySummaryV1.version;
  cluster.summaryGeneratedAt = new Date().toISOString();
  cluster.clusterHash = hash;
  await repo.upsertCluster(cluster);
  return true;
}

/** Full ingestion pass for one cron group. Pass `repo` to inject a store. */
export async function runIngestion(
  group: CronGroup,
  options: { force?: boolean; repo?: Repository } = {},
): Promise<IngestionSummary> {
  const repo = options.repo ?? (await getRepository());
  const now = new Date();
  const summary: IngestionSummary = {
    fetched: 0,
    created: 0,
    duplicates: 0,
    failed: 0,
    clustersUpdated: 0,
    summariesGenerated: 0,
    alertsSent: 0,
    runIds: [],
  };

  const allSources = await repo.listSources();
  const due = options.force
    ? allSources.filter((s) => s.enabled && s.group === group)
    : selectDueSources(allSources, group, now);

  const grouped = new Map<string, NewsSource[]>();
  for (const source of due) {
    const list = grouped.get(source.provider) ?? [];
    list.push(source);
    grouped.set(source.provider, list);
  }

  const interests = await repo.getInterests();
  const sourceById = new Map(allSources.map((s) => [s.id, s]));
  const fetches = await fetchProviders(grouped as Map<import("./types").ProviderId, NewsSource[]>);

  // Accumulate dedup scope once (recent window) to keep the pass incremental.
  const dedupScope = await repo.recentTitlesForDedup(pulseConfig.scoring.dedupTimeWindowHours);
  const seenUrls = new Set<string>();
  const seenTitles: { canonicalUrl: string; title: string; publishedAt: string }[] = [];

  for (const fetch of fetches) {
    const runId = crypto.randomUUID();
    summary.runIds.push(runId);
    await repo.startRun({
      id: runId,
      provider: fetch.provider,
      group,
      startedAt: now.toISOString(),
      fetched: fetch.articles.length,
      created: 0,
      duplicates: 0,
      failed: fetch.outcomes.filter((o) => o.error).length,
    });
    await repo.recordUsage("cron_run", 1, { provider: fetch.provider });

    const affectedClusters = new Set<string>();

    for (const raw of fetch.articles) {
      summary.fetched += 1;
      const identity = articleIdentity(raw);
      const verdict = dedupe(
        { url: identity.canonicalUrl, title: raw.title, publishedAt: raw.publishedAt },
        {
          hasCanonicalUrl: (url) =>
            seenUrls.has(url) || dedupScope.some((c) => c.canonicalUrl === url),
          recent: () => [...dedupScope, ...seenTitles],
        },
        {
          tokenThreshold: pulseConfig.scoring.dedupTokenThreshold,
          timeWindowHours: pulseConfig.scoring.dedupTimeWindowHours,
          now,
        },
      );
      if (verdict.duplicate) {
        summary.duplicates += 1;
        continue;
      }

      const source = sourceById.get(raw.sourceId);
      const article = normalizeIncoming(raw, interests, now);
      if (source) {
        article.sourceAuthority = source.authorityScore;
      }
      article.importanceScore = computeImportance({
        sourceAuthority: article.sourceAuthority,
        sourceCount: 1,
        velocity: 0,
        entityImportance: entityImportanceScore(article.entities),
        geoCount: article.country ? 1 : 0,
        hoursSinceUpdate: (now.getTime() - new Date(article.publishedAt).getTime()) / 3_600_000,
      });

      const created = await repo.insertArticle(article);
      if (!created) {
        summary.duplicates += 1;
        continue;
      }
      summary.created += 1;
      seenUrls.add(identity.canonicalUrl);
      seenTitles.push({
        canonicalUrl: identity.canonicalUrl,
        title: raw.title,
        publishedAt: article.publishedAt,
      });
      await repo.recordArticleTaxonomy(article.id, article.publishedAt, article.topics, article.entities);
      await repo.recordUsage("articles_fetched", 1);
      await repo.recordUsage("articles_created", 1);

      const cluster = await attachToCluster(repo, article, now);
      affectedClusters.add(cluster.id);
    }

    // Enqueue AI summaries for important clusters only (cost §53/§58).
    for (const clusterId of affectedClusters) {
      const cluster = await repo.getCluster(clusterId);
      if (
        cluster &&
        cluster.importanceScore >= pulseConfig.ai.summarizeThreshold &&
        cluster.sourceCount >= pulseConfig.ai.minSourcesForSummary &&
        (!cluster.summaryShort || cluster.summaryVersion !== storySummaryV1.version)
      ) {
        await repo.enqueueJob("summarize-cluster", { clusterId });
      }
    }

    // Mark sources fetched (with conditional-cache metadata).
    for (const outcome of fetch.outcomes) {
      if (outcome.error) summary.failed += 1;
      await repo.markSourceFetched(outcome.sourceId, now.toISOString(), outcome.conditional);
    }

    await repo.finishRun(runId, {
      finishedAt: new Date().toISOString(),
      fetched: fetch.articles.length,
      created: summary.created,
      duplicates: summary.duplicates,
      failed: fetch.outcomes.filter((o) => o.error).length,
    });
  }

  // Process queued jobs in small batches (cost §80).
  summary.summariesGenerated = await processJobs(repo);

  // Breaking alerts (Telegram first — spec §84).
  summary.alertsSent = await processBreakingAlerts(repo);

  return summary;
}

/** Claim up to 20 pending jobs and execute them. */
export async function processJobs(repo: Repository): Promise<number> {
  const jobs = await repo.claimJobs(20);
  let generated = 0;
  for (const job of jobs) {
    try {
      if (job.type === "summarize-cluster") {
        const clusterId = String(job.payload.clusterId ?? "");
        const done = await summarizeCluster(repo, clusterId);
        if (done) generated += 1;
      }
      await repo.finishJob(job.id);
    } catch (error) {
      await repo.finishJob(job.id, error instanceof Error ? error.message : String(error));
    }
  }
  return generated;
}
