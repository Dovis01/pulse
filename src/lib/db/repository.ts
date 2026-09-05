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

/**
 * Storage port. Production uses PgRepository (Supabase Postgres via
 * DATABASE_URL). When DATABASE_URL is absent, MemoryRepository keeps Pulse
 * fully functional with seeded demo data — a missing key must never break
 * the app (cost spec §32/§37).
 */

export interface ArticleQuery {
  since?: string;
  until?: string;
  category?: Category;
  provider?: ProviderId;
  sourceId?: string;
  topic?: string;
  entity?: string;
  minImportance?: number;
  limit?: number;
  /** Cursor = publishedAt ISO of last item from previous page. */
  cursor?: string;
  orderBy?: "published" | "importance";
}

export interface ClusterQuery {
  since?: string;
  category?: Category;
  breakingOnly?: boolean;
  minImportance?: number;
  limit?: number;
  orderBy?: "importance" | "recent" | "breaking";
}

export interface TrendRow {
  label: string;
  kind: "entity" | "topic";
  current: number;
  baseline: number;
}

export interface UsageSummaryRow {
  kind: UsageKind;
  today: number;
  month: number;
  total: number;
}

export interface RunPatch {
  finishedAt?: string;
  fetched?: number;
  created?: number;
  duplicates?: number;
  failed?: number;
  error?: string;
}

export interface Repository {
  readonly kind: "postgres" | "memory";

  init(): Promise<void>;

  // ── sources ──
  listSources(): Promise<NewsSource[]>;
  saveSource(source: NewsSource): Promise<void>;
  markSourceFetched(id: string, at: string, metadata?: Record<string, unknown>): Promise<void>;
  /** Batch variant — one round-trip for a whole cron pass (serverless budget). */
  markSourcesFetched(entries: { id: string; at: string; metadata?: Record<string, unknown> }[]): Promise<void>;

  // ── articles ──
  findArticleByCanonicalUrl(url: string): Promise<Article | null>;
  insertArticle(article: Article): Promise<boolean>;
  recentTitlesForDedup(windowHours: number, limit?: number): Promise<
    { canonicalUrl: string; title: string; publishedAt: string }[]
  >;
  listArticles(query: ArticleQuery): Promise<Article[]>;
  getArticle(idOrSlug: string): Promise<Article | null>;
  countArticles(since?: string): Promise<number>;

  // ── clusters ──
  activeClusters(windowHours: number, limit?: number): Promise<StoryCluster[]>;
  upsertCluster(cluster: StoryCluster): Promise<void>;
  getCluster(idOrSlug: string): Promise<StoryCluster | null>;
  linkArticleCluster(articleId: string, clusterId: string): Promise<void>;
  clusterArticles(clusterId: string): Promise<Article[]>;
  listClusters(query: ClusterQuery): Promise<StoryCluster[]>;
  countClusters(since?: string): Promise<number>;

  // ── topics / entities ──
  recordArticleTaxonomy(
    articleId: string,
    publishedAt: string,
    topics: string[],
    entities: string[],
  ): Promise<void>;
  topEntities(since: string, limit: number): Promise<TrendRow[]>;
  topTopics(since: string, limit: number): Promise<TrendRow[]>;

  // ── briefs ──
  saveBrief(brief: DailyBrief): Promise<void>;
  latestBrief(kind?: DailyBrief["kind"]): Promise<DailyBrief | null>;

  // ── saved / read ──
  setSaved(articleId: string, saved: boolean): Promise<boolean>;
  listSaved(): Promise<Article[]>;
  savedIds(): Promise<Set<string>>;
  markRead(articleIds: string[]): Promise<void>;
  readIds(articleIds: string[]): Promise<Set<string>>;

  // ── interests ──
  getInterests(): Promise<UserInterest[]>;
  setInterest(topic: string, weight: number): Promise<void>;

  // ── jobs ──
  enqueueJob(type: JobType, payload: Record<string, unknown>, scheduledAt?: string): Promise<void>;
  claimJobs(limit: number): Promise<IngestionJob[]>;
  finishJob(id: string, error?: string): Promise<void>;

  // ── runs ──
  startRun(run: Omit<IngestionRun, "id"> & { id: string }): Promise<void>;
  finishRun(id: string, patch: RunPatch): Promise<void>;
  recentRuns(limit: number): Promise<IngestionRun[]>;

  // ── usage / notifications ──
  recordUsage(kind: UsageKind, amount?: number, meta?: Record<string, unknown>): Promise<void>;
  usageSummary(): Promise<UsageSummaryRow[]>;
  usageCountSince(kind: UsageKind, since: string): Promise<number>;
  recordNotification(n: Omit<NotificationRecord, "id" | "sentAt">): Promise<void>;
  notificationSentFor(clusterId: string, channel: NotificationRecord["channel"]): Promise<boolean>;
  notificationsToday(): Promise<number>;
  recentNotifications(limit: number): Promise<NotificationRecord[]>;

  // ── retention ──
  cleanup(options: {
    rawContentDays: number;
    articleDays: number;
    runDays: number;
    jobDays: number;
  }): Promise<{ articlesPruned: number; runsPruned: number; jobsPruned: number }>;

  // ── search ──
  searchArticles(q: string, limit: number): Promise<Article[]>;
}
