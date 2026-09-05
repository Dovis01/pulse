import { and, asc, desc, eq, gte, inArray, lt, lte, sql } from "drizzle-orm";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { DEFAULT_SOURCES } from "@/lib/news/registry";
import type {
  Article,
  Category,
  DailyBrief,
  IngestionJob,
  IngestionRun,
  JobType,
  NewsSource,
  NotificationRecord,
  ProviderId,
  StoryCluster,
  UsageKind,
  UserInterest,
} from "@/lib/news/types";
import { pulseConfig } from "@config/pulse.config";
import type {
  ArticleQuery,
  ClusterQuery,
  Repository,
  RunPatch,
  TrendRow,
  UsageSummaryRow,
} from "./repository";
import {
  articleClusterLinks,
  articleEntities,
  articleTopics,
  articles,
  dailyBriefs,
  ingestionJobs,
  ingestionRuns,
  notifications,
  readHistory,
  savedArticles,
  sources,
  storyClusters,
  usageEvents,
  userInterests,
} from "./schema";

type Db = PostgresJsDatabase<Record<string, never>>;

const iso = (d: Date | null | undefined): string | undefined => (d ? d.toISOString() : undefined);

function rowToArticle(r: typeof articles.$inferSelect): Article {
  return {
    id: r.id,
    sourceId: r.sourceId,
    sourceName: r.sourceName,
    sourceAuthority: r.sourceAuthority,
    sourceProvider: r.sourceProvider as ProviderId,
    externalId: r.externalId ?? undefined,
    url: r.url,
    canonicalUrl: r.canonicalUrl,
    title: r.title,
    description: r.description ?? undefined,
    content: r.content ?? undefined,
    author: r.author ?? undefined,
    imageUrl: r.imageUrl ?? undefined,
    language: r.language ?? undefined,
    country: r.country ?? undefined,
    category: r.category as Category,
    topics: r.topics,
    entities: r.entities,
    tags: r.tags,
    publishedAt: r.publishedAt.toISOString(),
    fetchedAt: r.fetchedAt.toISOString(),
    clusterId: r.clusterId ?? undefined,
    importanceScore: r.importanceScore,
    relevanceScore: r.relevanceScore,
    velocityScore: r.velocityScore,
    metadata: r.metadata ?? undefined,
  };
}

function rowToCluster(r: typeof storyClusters.$inferSelect): StoryCluster {
  return {
    id: r.id,
    canonicalTitle: r.canonicalTitle,
    slug: r.slug,
    category: r.category as Category,
    topics: r.topics,
    entities: r.entities,
    countries: r.countries,
    summaryShort: r.summaryShort ?? undefined,
    summaryFull: r.summaryFull ?? undefined,
    whyItMatters: r.whyItMatters ?? undefined,
    keyPoints: r.keyPoints ?? undefined,
    summaryModel: r.summaryModel ?? undefined,
    summaryVersion: r.summaryVersion ?? undefined,
    summaryGeneratedAt: iso(r.summaryGeneratedAt),
    clusterHash: r.clusterHash ?? undefined,
    importanceScore: r.importanceScore,
    breakingScore: r.breakingScore,
    velocityScore: r.velocityScore,
    relevanceScore: r.relevanceScore,
    sourceCount: r.sourceCount,
    firstSeenAt: r.firstSeenAt.toISOString(),
    lastUpdatedAt: r.lastUpdatedAt.toISOString(),
    isBreaking: r.isBreaking,
    notifiedAt: iso(r.notifiedAt),
    metadata: r.metadata ?? undefined,
  };
}

export class PgRepository implements Repository {
  readonly kind = "postgres" as const;
  private db: Db;
  private client: postgres.Sql;

  constructor(databaseUrl: string) {
    this.client = postgres(databaseUrl, {
      max: 5,
      prepare: false,
      connect_timeout: 10,
    });
    this.db = drizzle(this.client);
  }

  async init(): Promise<void> {
    const [sourceRow] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(sources);
    if ((sourceRow?.count ?? 0) === 0) {
      for (const s of DEFAULT_SOURCES) await this.saveSource(s);
    }
    const [interestRow] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(userInterests);
    if ((interestRow?.count ?? 0) === 0) {
      for (const i of pulseConfig.interests) await this.setInterest(i.topic, i.weight);
    }
  }

  // ── sources ────────────────────────────────────────────────────────
  async listSources(): Promise<NewsSource[]> {
    const rows = await this.db.select().from(sources).orderBy(asc(sources.name));
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      type: r.type as NewsSource["type"],
      url: r.url,
      provider: r.provider as ProviderId,
      category: r.category as Category,
      language: r.language ?? undefined,
      country: r.country ?? undefined,
      authorityScore: r.authorityScore,
      enabled: r.enabled,
      refreshIntervalMinutes: r.refreshIntervalMinutes,
      group: r.cronGroup as NewsSource["group"],
      lastFetchedAt: iso(r.lastFetchedAt),
      metadata: r.metadata ?? undefined,
    }));
  }

  async saveSource(source: NewsSource): Promise<void> {
    await this.db
      .insert(sources)
      .values({
        id: source.id,
        name: source.name,
        type: source.type,
        url: source.url,
        provider: source.provider,
        category: source.category,
        language: source.language,
        country: source.country,
        authorityScore: source.authorityScore,
        enabled: source.enabled,
        refreshIntervalMinutes: source.refreshIntervalMinutes,
        cronGroup: source.group,
        lastFetchedAt: source.lastFetchedAt ? new Date(source.lastFetchedAt) : null,
        metadata: source.metadata,
      })
      .onConflictDoUpdate({
        target: sources.id,
        set: {
          name: source.name,
          url: source.url,
          category: source.category,
          authorityScore: source.authorityScore,
          enabled: source.enabled,
          refreshIntervalMinutes: source.refreshIntervalMinutes,
          cronGroup: source.group,
        },
      });
  }

  async markSourceFetched(id: string, at: string, metadata?: Record<string, unknown>): Promise<void> {
    if (metadata) {
      const [current] = await this.db.select().from(sources).where(eq(sources.id, id));
      await this.db
        .update(sources)
        .set({ lastFetchedAt: new Date(at), metadata: { ...(current?.metadata ?? {}), ...metadata } })
        .where(eq(sources.id, id));
    } else {
      await this.db.update(sources).set({ lastFetchedAt: new Date(at) }).where(eq(sources.id, id));
    }
  }

  // ── articles ───────────────────────────────────────────────────────
  async findArticleByCanonicalUrl(url: string): Promise<Article | null> {
    const [row] = await this.db.select().from(articles).where(eq(articles.canonicalUrl, url)).limit(1);
    return row ? rowToArticle(row) : null;
  }

  async insertArticle(article: Article): Promise<boolean> {
    const rows = await this.db
      .insert(articles)
      .values({
        id: article.id,
        sourceId: article.sourceId,
        sourceName: article.sourceName,
        sourceAuthority: article.sourceAuthority,
        sourceProvider: article.sourceProvider,
        externalId: article.externalId,
        url: article.url,
        canonicalUrl: article.canonicalUrl,
        title: article.title,
        description: article.description,
        content: article.content,
        author: article.author,
        imageUrl: article.imageUrl,
        language: article.language,
        country: article.country,
        category: article.category,
        topics: article.topics,
        entities: article.entities,
        tags: article.tags,
        publishedAt: new Date(article.publishedAt),
        fetchedAt: new Date(article.fetchedAt),
        clusterId: article.clusterId,
        importanceScore: article.importanceScore,
        relevanceScore: article.relevanceScore,
        velocityScore: article.velocityScore,
        metadata: article.metadata,
      })
      .onConflictDoNothing({ target: articles.canonicalUrl })
      .returning({ id: articles.id });
    return rows.length > 0;
  }

  async recentTitlesForDedup(windowHours: number, limit = 800) {
    const cutoff = new Date(Date.now() - windowHours * 3_600_000);
    const rows = await this.db
      .select({
        canonicalUrl: articles.canonicalUrl,
        title: articles.title,
        publishedAt: articles.publishedAt,
      })
      .from(articles)
      .where(gte(articles.publishedAt, cutoff))
      .orderBy(desc(articles.publishedAt))
      .limit(limit);
    return rows.map((r) => ({
      canonicalUrl: r.canonicalUrl,
      title: r.title,
      publishedAt: r.publishedAt.toISOString(),
    }));
  }

  async listArticles(query: ArticleQuery): Promise<Article[]> {
    const conditions = [];
    if (query.since) conditions.push(gte(articles.publishedAt, new Date(query.since)));
    if (query.until) conditions.push(lte(articles.publishedAt, new Date(query.until)));
    if (query.cursor) conditions.push(lt(articles.publishedAt, new Date(query.cursor)));
    if (query.category) conditions.push(eq(articles.category, query.category));
    if (query.provider) conditions.push(eq(articles.sourceProvider, query.provider));
    if (query.sourceId) conditions.push(eq(articles.sourceId, query.sourceId));
    if (query.minImportance) conditions.push(gte(articles.importanceScore, query.minImportance));
    if (query.topic)
      conditions.push(
        sql`${articles.id} in (
          select article_id from article_topics where lower(topic) like ${`%${query.topic.toLowerCase()}%`}
          union
          select article_id from article_entities where lower(entity) like ${`%${query.topic.toLowerCase()}%`}
        )`,
      );
    if (query.entity)
      conditions.push(
        sql`${articles.id} in (select article_id from article_entities where lower(entity) like ${`%${query.entity.toLowerCase()}%`})`,
      );

    const rows = await this.db
      .select()
      .from(articles)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(
        query.orderBy === "importance" ? desc(articles.importanceScore) : desc(articles.publishedAt),
      )
      .limit(query.limit ?? 30);
    return rows.map(rowToArticle);
  }

  async getArticle(idOrSlug: string): Promise<Article | null> {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrSlug);
    const [row] = await this.db
      .select()
      .from(articles)
      .where(isUuid ? eq(articles.id, idOrSlug) : eq(articles.canonicalUrl, idOrSlug))
      .limit(1);
    return row ? rowToArticle(row) : null;
  }

  async countArticles(since?: string): Promise<number> {
    const [row] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(articles)
      .where(since ? gte(articles.publishedAt, new Date(since)) : undefined);
    return row?.count ?? 0;
  }

  // ── clusters ───────────────────────────────────────────────────────
  async activeClusters(windowHours: number, limit = 200): Promise<StoryCluster[]> {
    const cutoff = new Date(Date.now() - windowHours * 3_600_000);
    const rows = await this.db
      .select()
      .from(storyClusters)
      .where(gte(storyClusters.lastUpdatedAt, cutoff))
      .orderBy(desc(storyClusters.lastUpdatedAt))
      .limit(limit);
    return rows.map(rowToCluster);
  }

  async upsertCluster(cluster: StoryCluster): Promise<void> {
    await this.db
      .insert(storyClusters)
      .values({
        id: cluster.id,
        canonicalTitle: cluster.canonicalTitle,
        slug: cluster.slug,
        category: cluster.category,
        topics: cluster.topics,
        entities: cluster.entities,
        countries: cluster.countries,
        summaryShort: cluster.summaryShort,
        summaryFull: cluster.summaryFull,
        whyItMatters: cluster.whyItMatters,
        keyPoints: cluster.keyPoints,
        summaryModel: cluster.summaryModel,
        summaryVersion: cluster.summaryVersion,
        summaryGeneratedAt: cluster.summaryGeneratedAt ? new Date(cluster.summaryGeneratedAt) : null,
        clusterHash: cluster.clusterHash,
        importanceScore: cluster.importanceScore,
        breakingScore: cluster.breakingScore,
        velocityScore: cluster.velocityScore,
        relevanceScore: cluster.relevanceScore,
        sourceCount: cluster.sourceCount,
        firstSeenAt: new Date(cluster.firstSeenAt),
        lastUpdatedAt: new Date(cluster.lastUpdatedAt),
        isBreaking: cluster.isBreaking,
        notifiedAt: cluster.notifiedAt ? new Date(cluster.notifiedAt) : null,
        metadata: cluster.metadata,
      })
      .onConflictDoUpdate({
        target: storyClusters.id,
        set: {
          canonicalTitle: cluster.canonicalTitle,
          slug: cluster.slug,
          category: cluster.category,
          topics: cluster.topics,
          entities: cluster.entities,
          countries: cluster.countries,
          summaryShort: cluster.summaryShort,
          summaryFull: cluster.summaryFull,
          whyItMatters: cluster.whyItMatters,
          keyPoints: cluster.keyPoints,
          summaryModel: cluster.summaryModel,
          summaryVersion: cluster.summaryVersion,
          summaryGeneratedAt: cluster.summaryGeneratedAt ? new Date(cluster.summaryGeneratedAt) : null,
          clusterHash: cluster.clusterHash,
          importanceScore: cluster.importanceScore,
          breakingScore: cluster.breakingScore,
          velocityScore: cluster.velocityScore,
          relevanceScore: cluster.relevanceScore,
          sourceCount: cluster.sourceCount,
          lastUpdatedAt: new Date(cluster.lastUpdatedAt),
          isBreaking: cluster.isBreaking,
          notifiedAt: cluster.notifiedAt ? new Date(cluster.notifiedAt) : null,
          metadata: cluster.metadata,
        },
      });
  }

  async getCluster(idOrSlug: string): Promise<StoryCluster | null> {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrSlug);
    const [row] = await this.db
      .select()
      .from(storyClusters)
      .where(isUuid ? eq(storyClusters.id, idOrSlug) : eq(storyClusters.slug, idOrSlug))
      .limit(1);
    return row ? rowToCluster(row) : null;
  }

  async linkArticleCluster(articleId: string, clusterId: string): Promise<void> {
    await this.db.update(articles).set({ clusterId }).where(eq(articles.id, articleId));
    await this.db
      .insert(articleClusterLinks)
      .values({ articleId, clusterId })
      .onConflictDoNothing();
  }

  async clusterArticles(clusterId: string): Promise<Article[]> {
    const rows = await this.db
      .select()
      .from(articles)
      .where(eq(articles.clusterId, clusterId))
      .orderBy(desc(articles.publishedAt));
    return rows.map(rowToArticle);
  }

  async listClusters(query: ClusterQuery): Promise<StoryCluster[]> {
    const conditions = [];
    if (query.since) conditions.push(gte(storyClusters.lastUpdatedAt, new Date(query.since)));
    if (query.category) conditions.push(eq(storyClusters.category, query.category));
    if (query.breakingOnly) conditions.push(eq(storyClusters.isBreaking, true));
    if (query.minImportance)
      conditions.push(gte(storyClusters.importanceScore, query.minImportance));
    const order =
      query.orderBy === "recent"
        ? desc(storyClusters.lastUpdatedAt)
        : query.orderBy === "breaking"
          ? desc(storyClusters.breakingScore)
          : desc(storyClusters.importanceScore);
    const rows = await this.db
      .select()
      .from(storyClusters)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(order)
      .limit(query.limit ?? 30);
    return rows.map(rowToCluster);
  }

  async countClusters(since?: string): Promise<number> {
    const [row] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(storyClusters)
      .where(since ? gte(storyClusters.lastUpdatedAt, new Date(since)) : undefined);
    return row?.count ?? 0;
  }

  // ── taxonomy ───────────────────────────────────────────────────────
  async recordArticleTaxonomy(
    articleId: string,
    publishedAt: string,
    topics: string[],
    entities: string[],
  ): Promise<void> {
    const published = new Date(publishedAt);
    if (topics.length > 0) {
      await this.db
        .insert(articleTopics)
        .values(topics.map((t) => ({ articleId, topic: t, publishedAt: published })))
        .onConflictDoNothing();
    }
    if (entities.length > 0) {
      await this.db
        .insert(articleEntities)
        .values(entities.map((e) => ({ articleId, entity: e, publishedAt: published })))
        .onConflictDoNothing();
    }
  }

  async topEntities(since: string, limit: number): Promise<TrendRow[]> {
    const sinceDate = new Date(since);
    const rows = await this.db
      .select({
        label: articleEntities.entity,
        current: sql<number>`count(*) filter (where ${articleEntities.publishedAt} >= ${sinceDate})::int`,
        baseline: sql<number>`count(*) filter (where ${articleEntities.publishedAt} < ${sinceDate})::int`,
      })
      .from(articleEntities)
      .groupBy(articleEntities.entity)
      .orderBy(sql`2 desc`)
      .limit(limit);
    return rows.map((r) => ({ label: r.label, kind: "entity", current: r.current, baseline: r.baseline }));
  }

  async topTopics(since: string, limit: number): Promise<TrendRow[]> {
    const sinceDate = new Date(since);
    const rows = await this.db
      .select({
        label: articleTopics.topic,
        current: sql<number>`count(*) filter (where ${articleTopics.publishedAt} >= ${sinceDate})::int`,
        baseline: sql<number>`count(*) filter (where ${articleTopics.publishedAt} < ${sinceDate})::int`,
      })
      .from(articleTopics)
      .groupBy(articleTopics.topic)
      .orderBy(sql`2 desc`)
      .limit(limit);
    return rows.map((r) => ({ label: r.label, kind: "topic", current: r.current, baseline: r.baseline }));
  }

  // ── briefs ─────────────────────────────────────────────────────────
  async saveBrief(brief: DailyBrief): Promise<void> {
    await this.db
      .insert(dailyBriefs)
      .values({
        kind: brief.kind,
        briefDate: brief.briefDate,
        intro: brief.intro,
        sections: brief.sections,
        watchList: brief.watchList,
        storyCount: brief.storyCount,
        model: brief.model,
        version: brief.version,
        generatedAt: new Date(brief.generatedAt),
      })
      .onConflictDoUpdate({
        target: [dailyBriefs.kind, dailyBriefs.briefDate],
        set: {
          intro: brief.intro,
          sections: brief.sections,
          watchList: brief.watchList,
          storyCount: brief.storyCount,
          model: brief.model,
          version: brief.version,
          generatedAt: new Date(brief.generatedAt),
        },
      });
  }

  async latestBrief(kind?: DailyBrief["kind"]): Promise<DailyBrief | null> {
    const rows = await this.db
      .select()
      .from(dailyBriefs)
      .where(kind ? eq(dailyBriefs.kind, kind) : undefined)
      .orderBy(desc(dailyBriefs.generatedAt))
      .limit(1);
    const r = rows[0];
    if (!r) return null;
    return {
      id: r.id,
      kind: r.kind as DailyBrief["kind"],
      briefDate: r.briefDate,
      intro: r.intro,
      sections: r.sections,
      watchList: r.watchList,
      storyCount: r.storyCount,
      model: r.model ?? undefined,
      version: r.version ?? undefined,
      generatedAt: r.generatedAt.toISOString(),
    };
  }

  // ── saved / read ───────────────────────────────────────────────────
  async setSaved(articleId: string, saved: boolean): Promise<boolean> {
    if (saved) {
      await this.db.insert(savedArticles).values({ articleId }).onConflictDoNothing();
    } else {
      await this.db.delete(savedArticles).where(eq(savedArticles.articleId, articleId));
    }
    const [row] = await this.db
      .select({ id: articles.id })
      .from(articles)
      .where(eq(articles.id, articleId));
    return Boolean(row);
  }

  async listSaved(): Promise<Article[]> {
    const rows = await this.db
      .select({ article: articles, savedAt: savedArticles.savedAt })
      .from(savedArticles)
      .innerJoin(articles, eq(articles.id, savedArticles.articleId))
      .orderBy(desc(savedArticles.savedAt));
    return rows.map((r) => rowToArticle(r.article));
  }

  async savedIds(): Promise<Set<string>> {
    const rows = await this.db.select({ id: savedArticles.articleId }).from(savedArticles);
    return new Set(rows.map((r) => r.id));
  }

  async markRead(articleIds: string[]): Promise<void> {
    if (articleIds.length === 0) return;
    await this.db
      .insert(readHistory)
      .values(articleIds.map((id) => ({ articleId: id })))
      .onConflictDoNothing();
  }

  async readIds(articleIds: string[]): Promise<Set<string>> {
    if (articleIds.length === 0) return new Set();
    const rows = await this.db
      .select({ id: readHistory.articleId })
      .from(readHistory)
      .where(inArray(readHistory.articleId, articleIds));
    return new Set(rows.map((r) => r.id));
  }

  // ── interests ──────────────────────────────────────────────────────
  async getInterests(): Promise<UserInterest[]> {
    const rows = await this.db
      .select()
      .from(userInterests)
      .orderBy(desc(userInterests.weight));
    return rows.map((r) => ({ topic: r.topic, weight: r.weight }));
  }

  async setInterest(topic: string, weight: number): Promise<void> {
    await this.db
      .insert(userInterests)
      .values({ topic, weight })
      .onConflictDoUpdate({
        target: userInterests.topic,
        set: { weight, updatedAt: new Date() },
      });
  }

  // ── jobs ───────────────────────────────────────────────────────────
  async enqueueJob(type: JobType, payload: Record<string, unknown>, scheduledAt?: string): Promise<void> {
    await this.db.insert(ingestionJobs).values({
      type,
      payload,
      scheduledAt: scheduledAt ? new Date(scheduledAt) : new Date(),
    });
  }

  async claimJobs(limit: number): Promise<IngestionJob[]> {
    const rows = await this.db
      .update(ingestionJobs)
      .set({ status: "processing", attempts: sql`${ingestionJobs.attempts} + 1` })
      .where(
        sql`${ingestionJobs.id} in (
          select id from ingestion_jobs
          where status = 'pending' and scheduled_at <= now()
          order by scheduled_at asc
          limit ${limit}
        )`,
      )
      .returning();
    return rows.map((r) => ({
      id: r.id,
      type: r.type as JobType,
      payload: r.payload,
      status: r.status as IngestionJob["status"],
      attempts: r.attempts,
      createdAt: r.createdAt.toISOString(),
      scheduledAt: r.scheduledAt.toISOString(),
      completedAt: iso(r.completedAt),
      lastError: r.lastError ?? undefined,
    }));
  }

  async finishJob(id: string, error?: string): Promise<void> {
    if (error) {
      await this.db
        .update(ingestionJobs)
        .set({
          status: sql`case when attempts >= 3 then 'failed' else 'pending' end`,
          lastError: error,
          completedAt: new Date(),
        })
        .where(eq(ingestionJobs.id, id));
    } else {
      await this.db
        .update(ingestionJobs)
        .set({ status: "completed", completedAt: new Date() })
        .where(eq(ingestionJobs.id, id));
    }
  }

  // ── runs ───────────────────────────────────────────────────────────
  async startRun(run: Omit<IngestionRun, "id"> & { id: string }): Promise<void> {
    await this.db.insert(ingestionRuns).values({
      id: run.id,
      provider: run.provider,
      cronGroup: run.group,
      startedAt: new Date(run.startedAt),
      fetched: run.fetched,
      created: run.created,
      duplicates: run.duplicates,
      failed: run.failed,
      error: run.error,
    });
  }

  async finishRun(id: string, patch: RunPatch): Promise<void> {
    await this.db
      .update(ingestionRuns)
      .set({
        finishedAt: patch.finishedAt ? new Date(patch.finishedAt) : undefined,
        fetched: patch.fetched,
        created: patch.created,
        duplicates: patch.duplicates,
        failed: patch.failed,
        error: patch.error,
      })
      .where(eq(ingestionRuns.id, id));
  }

  async recentRuns(limit: number): Promise<IngestionRun[]> {
    const rows = await this.db
      .select()
      .from(ingestionRuns)
      .orderBy(desc(ingestionRuns.startedAt))
      .limit(limit);
    return rows.map((r) => ({
      id: r.id,
      provider: r.provider,
      group: r.cronGroup as IngestionRun["group"],
      startedAt: r.startedAt.toISOString(),
      finishedAt: iso(r.finishedAt),
      fetched: r.fetched,
      created: r.created,
      duplicates: r.duplicates,
      failed: r.failed,
      error: r.error ?? undefined,
    }));
  }

  // ── usage / notifications ──────────────────────────────────────────
  async recordUsage(kind: UsageKind, amount = 1, meta?: Record<string, unknown>): Promise<void> {
    await this.db.insert(usageEvents).values({ kind, amount, meta });
  }

  async usageSummary(): Promise<UsageSummaryRow[]> {
    const rows = await this.db
      .select({
        kind: usageEvents.kind,
        today: sql<number>`count(*) filter (where ${usageEvents.at} >= date_trunc('day', now()))::int`,
        month: sql<number>`count(*) filter (where ${usageEvents.at} >= date_trunc('month', now()))::int`,
        total: sql<number>`count(*)::int`,
      })
      .from(usageEvents)
      .groupBy(usageEvents.kind);
    return rows.map((r) => ({ kind: r.kind as UsageKind, today: r.today, month: r.month, total: r.total }));
  }

  async usageCountSince(kind: UsageKind, since: string): Promise<number> {
    const [row] = await this.db
      .select({ count: sql<number>`coalesce(sum(${usageEvents.amount}), 0)::int` })
      .from(usageEvents)
      .where(and(eq(usageEvents.kind, kind), gte(usageEvents.at, new Date(since))));
    return row?.count ?? 0;
  }

  async recordNotification(n: Omit<NotificationRecord, "id" | "sentAt">): Promise<void> {
    await this.db.insert(notifications).values({
      channel: n.channel,
      clusterId: n.clusterId,
      subject: n.subject,
      status: n.status,
      error: n.error,
    });
  }

  async notificationSentFor(clusterId: string, channel: NotificationRecord["channel"]): Promise<boolean> {
    const [row] = await this.db
      .select({ id: notifications.id })
      .from(notifications)
      .where(and(eq(notifications.clusterId, clusterId), eq(notifications.channel, channel)))
      .limit(1);
    return Boolean(row);
  }

  async notificationsToday(): Promise<number> {
    const [row] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(notifications)
      .where(gte(notifications.sentAt, sql`date_trunc('day', now())`));
    return row?.count ?? 0;
  }

  async recentNotifications(limit: number): Promise<NotificationRecord[]> {
    const rows = await this.db
      .select()
      .from(notifications)
      .orderBy(desc(notifications.sentAt))
      .limit(limit);
    return rows.map((r) => ({
      id: r.id,
      channel: r.channel as NotificationRecord["channel"],
      clusterId: r.clusterId ?? undefined,
      subject: r.subject,
      sentAt: r.sentAt.toISOString(),
      status: r.status as NotificationRecord["status"],
      error: r.error ?? undefined,
    }));
  }

  // ── retention ──────────────────────────────────────────────────────
  async cleanup(options: {
    rawContentDays: number;
    articleDays: number;
    runDays: number;
    jobDays: number;
  }): Promise<{ articlesPruned: number; runsPruned: number; jobsPruned: number }> {
    const rawCutoff = new Date(Date.now() - options.rawContentDays * 86_400_000);
    await this.db
      .update(articles)
      .set({ content: null })
      .where(and(lt(articles.fetchedAt, rawCutoff), sql`${articles.content} is not null`));

    const articleCutoff = new Date(Date.now() - options.articleDays * 86_400_000);
    const pruned = await this.db
      .delete(articles)
      .where(
        and(
          lt(articles.publishedAt, articleCutoff),
          sql`${articles.id} not in (select article_id from saved_articles)`,
        ),
      )
      .returning({ id: articles.id });

    const runCutoff = new Date(Date.now() - options.runDays * 86_400_000);
    const prunedRuns = await this.db
      .delete(ingestionRuns)
      .where(lt(ingestionRuns.startedAt, runCutoff))
      .returning({ id: ingestionRuns.id });

    const jobCutoff = new Date(Date.now() - options.jobDays * 86_400_000);
    const prunedJobs = await this.db
      .delete(ingestionJobs)
      .where(and(lt(ingestionJobs.completedAt, jobCutoff), inArray(ingestionJobs.status, ["completed", "failed"])))
      .returning({ id: ingestionJobs.id });

    return {
      articlesPruned: pruned.length,
      runsPruned: prunedRuns.length,
      jobsPruned: prunedJobs.length,
    };
  }

  /** Postgres FTS search (cost spec §64–66). */
  async searchArticles(q: string, limit: number): Promise<Article[]> {
    const rows = await this.db
      .select()
      .from(articles)
      .where(
        sql`to_tsvector('english', ${articles.title} || ' ' || coalesce(${articles.description}, '') || ' ' || ${articles.sourceName}) @@ websearch_to_tsquery('english', ${q})`,
      )
      .orderBy(
        sql`ts_rank(to_tsvector('english', ${articles.title} || ' ' || coalesce(${articles.description}, '')), websearch_to_tsquery('english', ${q})) desc`,
      )
      .limit(limit);
    return rows.map(rowToArticle);
  }

  async close(): Promise<void> {
    await this.client.end();
  }
}
