import type {
  Article,
  Category,
  DailyBrief,
  IngestionJob,
  IngestionRun,
  JobType,
  NewsSource,
  NotificationRecord,
  StoryCluster,
  UsageKind,
  UserInterest,
} from "@/lib/news/types";
import type {
  ArticleQuery,
  ClusterQuery,
  Repository,
  RunPatch,
  TrendRow,
  UsageSummaryRow,
} from "./repository";

/**
 * In-memory repository — demo/test fallback when DATABASE_URL is absent.
 * Implements the same port as the Postgres repository so the entire app,
 * pipeline included, runs without any external key (cost spec §32).
 */

interface Store {
  sources: Map<string, NewsSource>;
  articles: Map<string, Article>;
  clusters: Map<string, StoryCluster>;
  briefs: Map<string, DailyBrief>;
  interests: Map<string, UserInterest>;
  jobs: Map<string, IngestionJob>;
  runs: Map<string, IngestionRun>;
  saved: Map<string, string>;
  read: Map<string, string>;
  usage: { id: string; kind: UsageKind; amount: number; at: string }[];
  notifications: NotificationRecord[];
  taxonomy: { topic: Map<string, Set<string>>; entity: Map<string, Set<string>> };
}

function newStore(): Store {
  return {
    sources: new Map(),
    articles: new Map(),
    clusters: new Map(),
    briefs: new Map(),
    interests: new Map(),
    jobs: new Map(),
    runs: new Map(),
    saved: new Map(),
    read: new Map(),
    usage: [],
    notifications: [],
    taxonomy: { topic: new Map(), entity: new Map() },
  };
}

export class MemoryRepository implements Repository {
  readonly kind = "memory" as const;
  private store: Store = newStore();

  /** Load initial data (used by the seeder and tests). */
  hydrate(data: {
    sources?: NewsSource[];
    articles?: Article[];
    clusters?: StoryCluster[];
    interests?: UserInterest[];
  }): void {
    this.store = newStore();
    for (const s of data.sources ?? []) this.store.sources.set(s.id, s);
    for (const a of data.articles ?? []) this.store.articles.set(a.id, a);
    for (const c of data.clusters ?? []) this.store.clusters.set(c.id, c);
    for (const i of data.interests ?? []) this.store.interests.set(i.topic, i);
  }

  async init(): Promise<void> {
    /* nothing to bootstrap in memory */
  }

  private uid(): string {
    return crypto.randomUUID();
  }

  // ── sources ────────────────────────────────────────────────────────
  async listSources(): Promise<NewsSource[]> {
    return [...this.store.sources.values()];
  }

  async saveSource(source: NewsSource): Promise<void> {
    this.store.sources.set(source.id, source);
  }

  async markSourceFetched(id: string, at: string, metadata?: Record<string, unknown>): Promise<void> {
    const s = this.store.sources.get(id);
    if (s) {
      s.lastFetchedAt = at;
      if (metadata) s.metadata = { ...(s.metadata ?? {}), ...metadata };
    }
  }

  // ── articles ───────────────────────────────────────────────────────
  async findArticleByCanonicalUrl(url: string): Promise<Article | null> {
    for (const a of this.store.articles.values()) {
      if (a.canonicalUrl === url) return a;
    }
    return null;
  }

  async insertArticle(article: Article): Promise<boolean> {
    for (const existing of this.store.articles.values()) {
      if (existing.canonicalUrl === article.canonicalUrl) return false;
    }
    this.store.articles.set(article.id, article);
    return true;
  }

  async recentTitlesForDedup(windowHours: number, limit = 800) {
    const cutoff = Date.now() - windowHours * 3_600_000;
    return [...this.store.articles.values()]
      .filter((a) => new Date(a.publishedAt).getTime() >= cutoff)
      .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
      .slice(0, limit)
      .map((a) => ({ canonicalUrl: a.canonicalUrl, title: a.title, publishedAt: a.publishedAt }));
  }

  async listArticles(query: ArticleQuery): Promise<Article[]> {
    let items = [...this.store.articles.values()];
    if (query.since) items = items.filter((a) => a.publishedAt >= query.since!);
    if (query.until) items = items.filter((a) => a.publishedAt <= query.until!);
    if (query.category) items = items.filter((a) => a.category === query.category);
    if (query.provider) items = items.filter((a) => a.sourceProvider === query.provider);
    if (query.sourceId) items = items.filter((a) => a.sourceId === query.sourceId);
    if (query.topic) items = items.filter((a) => a.topics.some((t) => t.toLowerCase() === query.topic!.toLowerCase()));
    if (query.entity) items = items.filter((a) => a.entities.some((e) => e.toLowerCase() === query.entity!.toLowerCase()));
    if (query.minImportance) items = items.filter((a) => a.importanceScore >= query.minImportance!);
    if (query.cursor) items = items.filter((a) => a.publishedAt < query.cursor!);
    items.sort((a, b) =>
      query.orderBy === "importance"
        ? b.importanceScore - a.importanceScore
        : b.publishedAt.localeCompare(a.publishedAt),
    );
    return items.slice(0, query.limit ?? 30);
  }

  async getArticle(idOrSlug: string): Promise<Article | null> {
    return this.store.articles.get(idOrSlug) ?? null;
  }

  async countArticles(since?: string): Promise<number> {
    if (!since) return this.store.articles.size;
    return [...this.store.articles.values()].filter((a) => a.publishedAt >= since).length;
  }

  // ── clusters ───────────────────────────────────────────────────────
  async activeClusters(windowHours: number, limit = 200): Promise<StoryCluster[]> {
    const cutoff = new Date(Date.now() - windowHours * 3_600_000).toISOString();
    return [...this.store.clusters.values()]
      .filter((c) => c.lastUpdatedAt >= cutoff)
      .sort((a, b) => b.lastUpdatedAt.localeCompare(a.lastUpdatedAt))
      .slice(0, limit);
  }

  async upsertCluster(cluster: StoryCluster): Promise<void> {
    this.store.clusters.set(cluster.id, cluster);
  }

  async getCluster(idOrSlug: string): Promise<StoryCluster | null> {
    const byId = this.store.clusters.get(idOrSlug);
    if (byId) return byId;
    for (const cluster of this.store.clusters.values()) {
      if (cluster.slug === idOrSlug) return cluster;
    }
    return null;
  }

  async linkArticleCluster(articleId: string, clusterId: string): Promise<void> {
    const a = this.store.articles.get(articleId);
    if (a) a.clusterId = clusterId;
  }

  async clusterArticles(clusterId: string): Promise<Article[]> {
    return [...this.store.articles.values()]
      .filter((a) => a.clusterId === clusterId)
      .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
  }

  async listClusters(query: ClusterQuery): Promise<StoryCluster[]> {
    let items = [...this.store.clusters.values()];
    if (query.since) items = items.filter((c) => c.lastUpdatedAt >= query.since!);
    if (query.category) items = items.filter((c) => c.category === query.category);
    if (query.breakingOnly) items = items.filter((c) => c.isBreaking);
    if (query.minImportance) items = items.filter((c) => c.importanceScore >= query.minImportance!);
    switch (query.orderBy) {
      case "recent":
        items.sort((a, b) => b.lastUpdatedAt.localeCompare(a.lastUpdatedAt));
        break;
      case "breaking":
        items.sort((a, b) => b.breakingScore - a.breakingScore);
        break;
      default:
        items.sort((a, b) => b.importanceScore - a.importanceScore);
    }
    return items.slice(0, query.limit ?? 30);
  }

  async countClusters(since?: string): Promise<number> {
    if (!since) return this.store.clusters.size;
    return [...this.store.clusters.values()].filter((c) => c.lastUpdatedAt >= since).length;
  }

  // ── taxonomy ───────────────────────────────────────────────────────
  async recordArticleTaxonomy(
    articleId: string,
    publishedAt: string,
    topics: string[],
    entities: string[],
  ): Promise<void> {
    for (const t of topics) {
      const set = this.store.taxonomy.topic.get(t) ?? new Set<string>();
      set.add(articleId);
      this.store.taxonomy.topic.set(t, set);
    }
    for (const e of entities) {
      const set = this.store.taxonomy.entity.get(e) ?? new Set<string>();
      set.add(articleId);
      this.store.taxonomy.entity.set(e, set);
    }
  }

  async topEntities(since: string, limit: number): Promise<TrendRow[]> {
    void since;
    return [...this.store.taxonomy.entity.entries()]
      .map(([label, ids]) => ({
        label,
        kind: "entity" as const,
        current: ids.size,
        baseline: Math.max(0, ids.size - 1),
      }))
      .sort((a, b) => b.current - a.current)
      .slice(0, limit);
  }

  async topTopics(since: string, limit: number): Promise<TrendRow[]> {
    void since;
    return [...this.store.taxonomy.topic.entries()]
      .map(([label, ids]) => ({
        label,
        kind: "topic" as const,
        current: ids.size,
        baseline: Math.max(0, ids.size - 1),
      }))
      .sort((a, b) => b.current - a.current)
      .slice(0, limit);
  }

  // ── briefs ─────────────────────────────────────────────────────────
  async saveBrief(brief: DailyBrief): Promise<void> {
    this.store.briefs.set(`${brief.briefDate}:${brief.kind}`, brief);
  }

  async latestBrief(kind?: DailyBrief["kind"]): Promise<DailyBrief | null> {
    const items = [...this.store.briefs.values()]
      .filter((b) => (kind ? b.kind === kind : true))
      .sort((a, b) => b.generatedAt.localeCompare(a.generatedAt));
    return items[0] ?? null;
  }

  // ── saved / read ───────────────────────────────────────────────────
  async setSaved(articleId: string, saved: boolean): Promise<boolean> {
    if (saved) this.store.saved.set(articleId, new Date().toISOString());
    else this.store.saved.delete(articleId);
    return this.store.articles.has(articleId);
  }

  async listSaved(): Promise<Article[]> {
    return [...this.store.saved.keys()]
      .map((id) => this.store.articles.get(id))
      .filter((a): a is Article => Boolean(a))
      .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
  }

  async savedIds(): Promise<Set<string>> {
    return new Set(this.store.saved.keys());
  }

  async markRead(articleIds: string[]): Promise<void> {
    const now = new Date().toISOString();
    for (const id of articleIds) this.store.read.set(id, now);
  }

  async readIds(articleIds: string[]): Promise<Set<string>> {
    const out = new Set<string>();
    for (const id of articleIds) if (this.store.read.has(id)) out.add(id);
    return out;
  }

  // ── interests ──────────────────────────────────────────────────────
  async getInterests(): Promise<UserInterest[]> {
    return [...this.store.interests.values()].sort((a, b) => b.weight - a.weight);
  }

  async setInterest(topic: string, weight: number): Promise<void> {
    this.store.interests.set(topic, { topic, weight });
  }

  // ── jobs ───────────────────────────────────────────────────────────
  async enqueueJob(type: JobType, payload: Record<string, unknown>, scheduledAt?: string): Promise<void> {
    const now = new Date().toISOString();
    const job: IngestionJob = {
      id: this.uid(),
      type,
      payload,
      status: "pending",
      attempts: 0,
      createdAt: now,
      scheduledAt: scheduledAt ?? now,
    };
    this.store.jobs.set(job.id, job);
  }

  async claimJobs(limit: number): Promise<IngestionJob[]> {
    const now = new Date().toISOString();
    const pending = [...this.store.jobs.values()]
      .filter((j) => j.status === "pending" && j.scheduledAt <= now)
      .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))
      .slice(0, limit);
    for (const j of pending) {
      j.status = "processing";
      j.attempts += 1;
    }
    return pending;
  }

  async finishJob(id: string, error?: string): Promise<void> {
    const job = this.store.jobs.get(id);
    if (!job) return;
    job.completedAt = new Date().toISOString();
    if (error) {
      job.status = job.attempts >= 3 ? "failed" : "pending";
      job.lastError = error;
    } else {
      job.status = "completed";
    }
  }

  // ── runs ───────────────────────────────────────────────────────────
  async startRun(run: Omit<IngestionRun, "id"> & { id: string }): Promise<void> {
    this.store.runs.set(run.id, run);
  }

  async finishRun(id: string, patch: RunPatch): Promise<void> {
    const run = this.store.runs.get(id);
    if (run) Object.assign(run, patch);
  }

  async recentRuns(limit: number): Promise<IngestionRun[]> {
    return [...this.store.runs.values()]
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
      .slice(0, limit);
  }

  // ── usage / notifications ──────────────────────────────────────────
  async recordUsage(kind: UsageKind, amount = 1): Promise<void> {
    this.store.usage.push({ id: this.uid(), kind, amount, at: new Date().toISOString() });
  }

  async usageSummary(): Promise<UsageSummaryRow[]> {
    const now = new Date();
    const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const byKind = new Map<UsageKind, UsageSummaryRow>();
    for (const e of this.store.usage) {
      let row = byKind.get(e.kind);
      if (!row) {
        row = { kind: e.kind, today: 0, month: 0, total: 0 };
        byKind.set(e.kind, row);
      }
      row.total += e.amount;
      if (e.at >= monthStart) row.month += e.amount;
      if (e.at >= dayStart) row.today += e.amount;
    }
    return [...byKind.values()];
  }

  async usageCountSince(kind: UsageKind, since: string): Promise<number> {
    return this.store.usage
      .filter((e) => e.kind === kind && e.at >= since)
      .reduce((acc, e) => acc + e.amount, 0);
  }

  async recordNotification(n: Omit<NotificationRecord, "id" | "sentAt">): Promise<void> {
    this.store.notifications.push({
      ...n,
      id: this.uid(),
      sentAt: new Date().toISOString(),
    });
  }

  async notificationSentFor(clusterId: string, channel: NotificationRecord["channel"]): Promise<boolean> {
    return this.store.notifications.some((n) => n.clusterId === clusterId && n.channel === channel);
  }

  async notificationsToday(): Promise<number> {
    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);
    return this.store.notifications.filter((n) => n.sentAt >= dayStart.toISOString()).length;
  }

  async recentNotifications(limit: number): Promise<NotificationRecord[]> {
    return [...this.store.notifications]
      .sort((a, b) => b.sentAt.localeCompare(a.sentAt))
      .slice(0, limit);
  }

  // ── search ─────────────────────────────────────────────────────────
  async searchArticles(q: string, limit: number): Promise<Article[]> {
    const tokens = q.toLowerCase().split(/\s+/).filter(Boolean);
    if (tokens.length === 0) return [];
    const scored: { article: Article; score: number }[] = [];
    for (const a of this.store.articles.values()) {
      const haystack = `${a.title} ${a.description ?? ""} ${a.sourceName}`.toLowerCase();
      let score = 0;
      for (const t of tokens) {
        if (a.title.toLowerCase().includes(t)) score += 2;
        else if (haystack.includes(t)) score += 1;
      }
      if (score > 0) scored.push({ article: a, score });
    }
    scored.sort((x, y) => y.score - x.score);
    return scored.slice(0, limit).map((s) => s.article);
  }

  // ── retention ──────────────────────────────────────────────────────
  async cleanup(options: {
    rawContentDays: number;
    articleDays: number;
    runDays: number;
    jobDays: number;
  }): Promise<{ articlesPruned: number; runsPruned: number; jobsPruned: number }> {
    const now = Date.now();
    const rawCutoff = new Date(now - options.rawContentDays * 86_400_000).toISOString();
    for (const a of this.store.articles.values()) {
      if (a.fetchedAt < rawCutoff && a.content) {
        a.content = undefined;
      }
    }
    const articleCutoff = new Date(now - options.articleDays * 86_400_000).toISOString();
    const saved = new Set(this.store.saved.keys());
    let articlesPruned = 0;
    for (const [id, a] of this.store.articles) {
      if (a.publishedAt < articleCutoff && !saved.has(id)) {
        this.store.articles.delete(id);
        articlesPruned += 1;
      }
    }
    const runCutoff = new Date(now - options.runDays * 86_400_000).toISOString();
    let runsPruned = 0;
    for (const [id, r] of this.store.runs) {
      if (r.startedAt < runCutoff) {
        this.store.runs.delete(id);
        runsPruned += 1;
      }
    }
    const jobCutoff = new Date(now - options.jobDays * 86_400_000).toISOString();
    let jobsPruned = 0;
    for (const [id, j] of this.store.jobs) {
      if (j.completedAt && j.completedAt < jobCutoff) {
        this.store.jobs.delete(id);
        jobsPruned += 1;
      }
    }
    return { articlesPruned, runsPruned, jobsPruned };
  }
}

export type { Category };
