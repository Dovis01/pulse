import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * Pulse database schema (product spec §26). Embeddings/pgvector are
 * intentionally absent from the MVP (cost spec §44/§119 — Phase 3).
 */

export const sources = pgTable("sources", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").notNull(),
  url: text("url").notNull(),
  provider: text("provider").notNull(),
  category: text("category").notNull(),
  language: text("language"),
  country: text("country"),
  authorityScore: integer("authority_score").notNull().default(50),
  enabled: boolean("enabled").notNull().default(true),
  refreshIntervalMinutes: integer("refresh_interval_minutes").notNull().default(30),
  cronGroup: text("cron_group").notNull().default("normal"),
  lastFetchedAt: timestamp("last_fetched_at", { withTimezone: true }),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const articles = pgTable(
  "articles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sourceId: text("source_id").notNull(),
    sourceName: text("source_name").notNull(),
    sourceAuthority: integer("source_authority").notNull().default(50),
    sourceProvider: text("source_provider").notNull(),
    externalId: text("external_id"),
    url: text("url").notNull(),
    canonicalUrl: text("canonical_url").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    content: text("content"),
    author: text("author"),
    imageUrl: text("image_url"),
    language: text("language"),
    country: text("country"),
    category: text("category").notNull().default("Other"),
    topics: jsonb("topics").$type<string[]>().notNull().default([]),
    entities: jsonb("entities").$type<string[]>().notNull().default([]),
    tags: jsonb("tags").$type<string[]>().notNull().default([]),
    publishedAt: timestamp("published_at", { withTimezone: true }).notNull(),
    fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
    clusterId: uuid("cluster_id"),
    importanceScore: real("importance_score").notNull().default(0),
    relevanceScore: real("relevance_score").notNull().default(0),
    velocityScore: real("velocity_score").notNull().default(0),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("articles_canonical_url_unique").on(t.canonicalUrl),
    index("articles_published_at_idx").on(t.publishedAt),
    index("articles_cluster_idx").on(t.clusterId),
    index("articles_category_idx").on(t.category),
  ],
);

export const storyClusters = pgTable(
  "story_clusters",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    canonicalTitle: text("canonical_title").notNull(),
    slug: text("slug").notNull(),
    category: text("category").notNull().default("Other"),
    topics: jsonb("topics").$type<string[]>().notNull().default([]),
    entities: jsonb("entities").$type<string[]>().notNull().default([]),
    countries: jsonb("countries").$type<string[]>().notNull().default([]),
    summaryShort: text("summary_short"),
    summaryFull: text("summary_full"),
    whyItMatters: text("why_it_matters"),
    keyPoints: jsonb("key_points").$type<string[]>(),
    summaryModel: text("summary_model"),
    summaryVersion: text("summary_version"),
    summaryGeneratedAt: timestamp("summary_generated_at", { withTimezone: true }),
    clusterHash: text("cluster_hash"),
    importanceScore: real("importance_score").notNull().default(0),
    breakingScore: real("breaking_score").notNull().default(0),
    velocityScore: real("velocity_score").notNull().default(0),
    relevanceScore: real("relevance_score").notNull().default(0),
    sourceCount: integer("source_count").notNull().default(0),
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).notNull().defaultNow(),
    lastUpdatedAt: timestamp("last_updated_at", { withTimezone: true }).notNull().defaultNow(),
    isBreaking: boolean("is_breaking").notNull().default(false),
    notifiedAt: timestamp("notified_at", { withTimezone: true }),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  },
  (t) => [
    unique("story_clusters_slug_unique").on(t.slug),
    index("story_clusters_updated_idx").on(t.lastUpdatedAt),
    index("story_clusters_importance_idx").on(t.importanceScore),
  ],
);

export const articleClusterLinks = pgTable(
  "article_cluster_links",
  () => ({
    articleId: uuid("article_id")
      .notNull()
      .references(() => articles.id, { onDelete: "cascade" }),
    clusterId: uuid("cluster_id")
      .notNull()
      .references(() => storyClusters.id, { onDelete: "cascade" }),
  }),
  (t) => [primaryKey({ columns: [t.articleId, t.clusterId] })],
);

export const topics = pgTable("topics", {
  name: text("name").primaryKey(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
});

export const articleTopics = pgTable(
  "article_topics",
  () => ({
    articleId: uuid("article_id")
      .notNull()
      .references(() => articles.id, { onDelete: "cascade" }),
    topic: text("topic").notNull(),
    publishedAt: timestamp("published_at", { withTimezone: true }).notNull(),
  }),
  (t) => [primaryKey({ columns: [t.articleId, t.topic] }), index("article_topics_topic_idx").on(t.topic)],
);

export const entities = pgTable("entities", {
  name: text("name").primaryKey(),
  weight: integer("weight").notNull().default(50),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
});

export const articleEntities = pgTable(
  "article_entities",
  () => ({
    articleId: uuid("article_id")
      .notNull()
      .references(() => articles.id, { onDelete: "cascade" }),
    entity: text("entity").notNull(),
    publishedAt: timestamp("published_at", { withTimezone: true }).notNull(),
  }),
  (t) => [
    primaryKey({ columns: [t.articleId, t.entity] }),
    index("article_entities_entity_idx").on(t.entity),
  ],
);

export const dailyBriefs = pgTable(
  "daily_briefs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    kind: text("kind").notNull(),
    briefDate: text("brief_date").notNull(),
    intro: text("intro").notNull(),
    sections: jsonb("sections").$type<{ label: string; text: string }[]>().notNull().default([]),
    watchList: jsonb("watch_list").$type<string[]>().notNull().default([]),
    introZh: text("intro_zh"),
    sectionsZh: jsonb("sections_zh").$type<{ label: string; text: string }[]>(),
    watchZh: jsonb("watch_zh").$type<string[]>(),
    storyCount: integer("story_count").notNull().default(0),
    model: text("model"),
    version: text("version"),
    generatedAt: timestamp("generated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("daily_briefs_kind_date_unique").on(t.kind, t.briefDate)],
);

export const userInterests = pgTable("user_interests", {
  topic: text("topic").primaryKey(),
  weight: real("weight").notNull().default(0.5),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const savedArticles = pgTable("saved_articles", {
  articleId: uuid("article_id")
    .primaryKey()
    .references(() => articles.id, { onDelete: "cascade" }),
  note: text("note"),
  savedAt: timestamp("saved_at", { withTimezone: true }).notNull().defaultNow(),
});

export const readHistory = pgTable("read_history", {
  articleId: uuid("article_id")
    .primaryKey()
    .references(() => articles.id, { onDelete: "cascade" }),
  readAt: timestamp("read_at", { withTimezone: true }).notNull().defaultNow(),
});

export const notifications = pgTable("notifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  channel: text("channel").notNull(),
  clusterId: uuid("cluster_id"),
  subject: text("subject").notNull(),
  sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
  status: text("status").notNull().default("sent"),
  error: text("error"),
});

export const ingestionJobs = pgTable(
  "ingestion_jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    type: text("type").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    status: text("status").notNull().default("pending"),
    attempts: integer("attempts").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    lastError: text("last_error"),
  },
  (t) => [index("ingestion_jobs_status_idx").on(t.status, t.scheduledAt)],
);

export const ingestionRuns = pgTable("ingestion_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  provider: text("provider").notNull(),
  cronGroup: text("cron_group").notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  fetched: integer("fetched").notNull().default(0),
  created: integer("created").notNull().default(0),
  duplicates: integer("duplicates").notNull().default(0),
  failed: integer("failed").notNull().default(0),
  error: text("error"),
});

export const usageEvents = pgTable(
  "usage_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    kind: text("kind").notNull(),
    amount: integer("amount").notNull().default(1),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
    meta: jsonb("meta").$type<Record<string, unknown>>(),
  },
  (t) => [index("usage_events_kind_at_idx").on(t.kind, t.at)],
);
