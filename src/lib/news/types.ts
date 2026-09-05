/**
 * Domain types for the Pulse news pipeline.
 * Layers: providers → normalize → dedup → classify → cluster → score → store.
 */

export type Category =
  | "AI"
  | "Technology"
  | "OpenSource"
  | "Markets"
  | "Business"
  | "World"
  | "Science"
  | "Cybersecurity"
  | "Other";

export type ProviderId =
  | "rss"
  | "gdelt"
  | "github"
  | "hackernews"
  | "arxiv"
  | "huggingface"
  | "newsapi";

export type CronGroup = "fast" | "normal";

/** Unified source registry entry (spec cost §11). */
export interface NewsSource {
  id: string;
  name: string;
  type: "rss" | "api" | "official";
  url: string;
  provider: ProviderId;
  category: Category;
  language?: string;
  country?: string;
  /** 20–95 per cost spec §29. */
  authorityScore: number;
  enabled: boolean;
  refreshIntervalMinutes: number;
  /** Cron group this source belongs to. */
  group: CronGroup;
  lastFetchedAt?: string;
  /** ETag / Last-Modified cache for conditional requests. */
  metadata?: Record<string, unknown>;
}

/** Raw item coming out of any provider, pre-normalization. */
export interface RawArticle {
  externalId?: string;
  url: string;
  title: string
  description?: string;
  content?: string;
  publishedAt: Date;
  sourceId: string;
  sourceName: string;
  author?: string;
  image?: string;
  language?: string;
  country?: string;
  /** Provider-specific signals (HN points, GitHub stars…). */
  metadata?: Record<string, unknown>;
}

/** Stored, normalized article. */
export interface Article {
  id: string;
  sourceId: string;
  sourceName: string;
  sourceAuthority: number;
  sourceProvider: ProviderId;
  externalId?: string;
  url: string;
  canonicalUrl: string;
  title: string;
  description?: string;
  /** Truncated excerpt only — full bodies are not archived (cost §40). */
  content?: string;
  author?: string;
  imageUrl?: string;
  language?: string;
  country?: string;
  category: Category;
  topics: string[];
  entities: string[];
  tags: string[];
  publishedAt: string;
  fetchedAt: string;
  clusterId?: string;
  importanceScore: number;
  relevanceScore: number;
  velocityScore: number;
  metadata?: Record<string, unknown>;
}

/** Aggregated story cluster ("one event, many sources"). */
export interface StoryCluster {
  id: string;
  canonicalTitle: string;
  slug: string;
  category: Category;
  topics: string[];
  entities: string[];
  countries: string[];
  summaryShort?: string;
  summaryFull?: string;
  whyItMatters?: string;
  keyPoints?: string[];
  summaryModel?: string;
  summaryVersion?: string;
  summaryGeneratedAt?: string;
  clusterHash?: string;
  importanceScore: number;
  breakingScore: number;
  velocityScore: number;
  relevanceScore: number;
  sourceCount: number;
  firstSeenAt: string;
  lastUpdatedAt: string;
  isBreaking: boolean;
  notifiedAt?: string;
  metadata?: Record<string, unknown>;
}

export interface DailyBrief {
  id: string;
  kind: "morning" | "evening";
  briefDate: string;
  intro: string;
  sections: { label: string; text: string }[];
  watchList: string[];
  storyCount: number;
  model?: string;
  version?: string;
  generatedAt: string;
}

export interface UserInterest {
  topic: string;
  weight: number;
}

export type JobType = "summarize-cluster" | "send-notification" | "generate-brief";

export interface IngestionJob {
  id: string;
  type: JobType;
  payload: Record<string, unknown>;
  status: "pending" | "processing" | "completed" | "failed";
  attempts: number;
  createdAt: string;
  scheduledAt: string;
  completedAt?: string;
  lastError?: string;
}

export interface IngestionRun {
  id: string;
  provider: string;
  group: CronGroup | "daily";
  startedAt: string;
  finishedAt?: string;
  fetched: number;
  created: number;
  duplicates: number;
  failed: number;
  error?: string;
}

export type UsageKind =
  | "ai_call"
  | "articles_fetched"
  | "articles_created"
  | "github_request"
  | "hf_request"
  | "email_sent"
  | "telegram_alert"
  | "cron_run";

export interface UsageEvent {
  id: string;
  kind: UsageKind;
  amount: number;
  at: string;
  meta?: Record<string, unknown>;
}

export interface NotificationRecord {
  id: string;
  channel: "telegram" | "email" | "webhook";
  clusterId?: string;
  subject: string;
  sentAt: string;
  status: "sent" | "failed" | "skipped";
  error?: string;
}

export interface SystemStatus {
  database: "postgres" | "memory";
  ai: { configured: boolean; provider: string; model: string; degraded: boolean };
  telegram: boolean;
  email: boolean;
  lastCronAt?: string;
  lastSuccessfulFetchAt?: string;
  sourcesHealthy: number;
  sourcesFailing: number;
  articleCount: number;
  clusterCount: number;
  lastBriefAt?: string;
}
