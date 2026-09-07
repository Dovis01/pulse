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
import { articleIdentity, decodeEntities, detectLanguage, slugify, titleTokens, truncate } from "./normalize";
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

/** Keep each serverless invocation small (cost spec §74: incremental). */
export const MAX_ARTICLES_PER_PROVIDER_RUN = 12;

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
    title: decodeEntities(raw.title).trim(),
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
 *
 * `seeds` carries the run-scoped active-cluster snapshot so hot paths don't
 * re-query the store per article (serverless time budget); pass a Map that
 * lives across the whole ingestion run.
 */
async function attachToCluster(
  repo: Repository,
  article: import("./types").Article,
  now: Date,
  seeds: Map<string, ClusterSeed>,
): Promise<string> {
  const windowHours = pulseConfig.scoring.clusterTimeWindowHours;

  const tokens = titleTokens(article.title);
  let matched: ClusterSeed | null = null;
  let bestSimilarity = 0;
  for (const seed of seeds.values()) {
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
    return matched.id;
  }

  // New cluster (written immediately so the FK for links resolves; the
  // expensive recompute happens once per batch for affected clusters).
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
  seedFromCluster(cluster, seeds);
  return id;
}

function seedFromCluster(cluster: StoryCluster, seeds: Map<string, ClusterSeed>): void {
  seeds.set(cluster.id, {
    id: cluster.id,
    canonicalTitle: cluster.canonicalTitle,
    category: cluster.category,
    entities: cluster.entities,
    topics: cluster.topics,
    countries: cluster.countries,
    sourceNames: [],
    createdAt: new Date(cluster.firstSeenAt),
    updatedAt: new Date(cluster.lastUpdatedAt),
    tokenSample: tokenSampleOf(cluster.canonicalTitle),
  });
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

  // Rule-based multi-source summary so every cluster reads well without AI.
  // AI later overwrites it (summaryModel stays unset until an AI pass).
  if (!updated.summaryShort) {
    const rule = composeClusterSummaryRule(clusterArticles);
    updated.summaryShort = rule.short;
    updated.summaryFull = updated.summaryFull ?? rule.full;
    updated.summaryVersion = "rule-v1";
    updated.whyItMatters = updated.whyItMatters ?? rule.whyItMatters;
    updated.keyPoints = updated.keyPoints ?? rule.keyPoints;
  }

  await repo.upsertCluster(updated);
  return updated;
}

/**
 * Compose a cluster summary from its member reports — deterministic,
 * source-attributed, no AI (aggregator mode, cost spec §62).
 */
export function composeClusterSummaryRule(articles: import("./types").Article[]): {
  short?: string;
  full?: string;
  whyItMatters?: string;
  keyPoints?: string[];
} {
  if (articles.length === 0) return {};
  const ranked = [...articles].sort(
    (a, b) => b.sourceAuthority - a.sourceAuthority || a.publishedAt.localeCompare(b.publishedAt),
  );
  const primary = ranked[0]!;
  const clean = (t: string | undefined) => (t ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

  const short = clean(primary.description) || primary.title;

  const pieces = ranked.slice(0, 3).map((a) => {
    const d = clean(a.description);
    return d.length > 0 ? `${a.sourceName} — ${d.slice(0, 260)}` : `${a.sourceName} — ${a.title}`;
  });
  const full = pieces.join("\n\n");

  const keyPoints = ranked
    .slice(0, 4)
    .map((a) => {
      const d = clean(a.description);
      return d.length > 24 ? d.slice(0, 160) : a.title;
    })
    .filter((p, i, arr) => p.length > 0 && arr.indexOf(p) === i);

  const topEntity = primary.entities[0];
  const whyItMatters =
    topEntity != null || primary.importanceScore >= 60
      ? `Covered by ${new Set(articles.map((a) => a.sourceId)).size} source${
          new Set(articles.map((a) => a.sourceId)).size === 1 ? "" : "s"
        }${topEntity ? ` with focus on ${topEntity.replace(/\b\w/g, (c) => c.toUpperCase())}` : ""}; importance ${primary.importanceScore}.`
      : undefined;

  return { short: short.slice(0, 220) || undefined, full, whyItMatters, keyPoints };
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

  // Run-scoped cluster seed snapshot — hot path stays off the database.
  const clusterSeeds = new Map<string, import("./clustering").ClusterSeed>();
  for (const c of await repo.activeClusters(pulseConfig.scoring.clusterTimeWindowHours)) {
    clusterSeeds.set(c.id, {
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
    });
  }
  const seenUrls = new Set<string>();
  const seenTitles: { canonicalUrl: string; title: string; publishedAt: string }[] = [];
  const pendingSourceMarks: { id: string; at: string; metadata?: Record<string, unknown> }[] = [];

  for (const fetch of fetches) {
    const runId = crypto.randomUUID();
    summary.runIds.push(runId);

    // Serverless-safe batch cap: one cron invocation processes at most this
    // many items per provider, newest first; older items are picked up on
    // the next scheduled run when the feed still returns them
    // (cost spec §74–75).
    const batch = [...fetch.articles]
      .sort((a, b) => (b.publishedAt?.getTime() ?? 0) - (a.publishedAt?.getTime() ?? 0))
      .slice(0, MAX_ARTICLES_PER_PROVIDER_RUN);

    await repo.startRun({
      id: runId,
      provider: fetch.provider,
      group,
      startedAt: now.toISOString(),
      fetched: batch.length,
      created: 0,
      duplicates: 0,
      failed: fetch.outcomes.filter((o) => o.error).length,
    });
    await repo.recordUsage("cron_run", 1, { provider: fetch.provider });

    const affectedClusters = new Set<string>();

    for (const raw of batch) {
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

      const clusterId = await attachToCluster(repo, article, now, clusterSeeds);
      affectedClusters.add(clusterId);
    }
    // One recompute per affected cluster per batch (not per article) —
    // keeps the Neon round-trip count inside the serverless budget.
        for (const clusterId of affectedClusters) {
      const updated = await recomputeCluster(repo, clusterId, now);
      seedFromCluster(updated, clusterSeeds);
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
        // Collect source marks for one batched write after the run records.
    for (const outcome of fetch.outcomes) {
      if (outcome.error) summary.failed += 1;
      pendingSourceMarks.push({
        id: outcome.sourceId,
        at: now.toISOString(),
        metadata: outcome.conditional,
      });
    }
    await repo.finishRun(runId, {
      finishedAt: new Date().toISOString(),
      fetched: batch.length,
      created: summary.created,
      duplicates: summary.duplicates,
      failed: fetch.outcomes.filter((o) => o.error).length,
    });
  }
  // One batched write for all source refresh marks (serverless budget).
  await repo.markSourcesFetched(pendingSourceMarks);

  // Process queued jobs in small batches (cost §80).
    summary.summariesGenerated = await processJobs(repo);

    // Breaking alerts (Telegram first — spec §84).
  summary.alertsSent = await processBreakingAlerts(repo);

  // Self-heal a rule-based brief if AI has recovered (re-sends digest).
  try {
    const { maybeUpgradeBrief } = await import("@/lib/brief/generate");
    await maybeUpgradeBrief(repo);
  } catch {
    // never block ingestion
  }

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
