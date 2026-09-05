# Database

PostgreSQL via plain `DATABASE_URL` (Supabase free tier by default — chosen
for free tier + pgvector path + zero maintenance). The app is
provider-agnostic: Neon, Railway or self-hosted Postgres work identically.
When `DATABASE_URL` is absent the app runs on the in-memory repository with
seeded data — a missing key must never break the app.

## Schema (Drizzle, `src/lib/db/schema.ts`)

| Table | Purpose |
|---|---|
| `sources` | source registry (authority, category, refresh interval, cron group, conditional-cache meta) |
| `articles` | normalized items; unique `canonical_url`; indexed by published_at / cluster / category |
| `story_clusters` | one event, many sources; canonical title, summaries (+model/version/hash), scores |
| `article_cluster_links` | explicit membership join |
| `topics`, `entities` + `article_topics`, `article_entities` | taxonomy with published_at for trend baselines |
| `daily_briefs` | morning/evening briefs, unique per (kind, date) |
| `user_interests` | personal relevance weights (editable in Settings) |
| `saved_articles`, `read_history` | personal state |
| `notifications` | sent-alert log (dedup + daily caps) |
| `ingestion_jobs` | serverless job queue (status/attempts/scheduled_at) |
| `ingestion_runs` | per-provider observability (fetched/created/duplicates/failed/error) |
| `usage_events` | cost & usage counters (AI calls, fetches, alerts…) |

Embeddings/pgvector are **deliberately absent** from MVP (cost spec §44) —
the schema reserves a clean path to add them in Phase 3.

## Migrations

```bash
npm run db:generate   # drizzle-kit generate → db/migrations/*.sql
npm run db:migrate    # apply (scripts/migrate.ts)
npm run db:seed       # sources + interests + 50-article sample corpus
```

The seed corpus (≥ 10 story clusters across categories and timestamps) is
generated **through the real pipeline** (classify → cluster → score), not
hand-mocked, so it exercises production logic.

## Search

V1 uses Postgres full-text search:

```sql
to_tsvector('english', title || description || source_name)
  @@ websearch_to_tsquery('english', :q)
ORDER BY ts_rank(...) DESC
```

The memory repository implements a token-overlap fallback with the same
port signature. Semantic search (pgvector) is a Phase-3 addition behind the
same interface — no search SaaS is ever introduced (cost §67).

## Retention

The daily cron enforces: raw content 7d · articles 365d (saved exempt) ·
runs 30d · completed jobs 7d. Storage discipline comes before capacity
purchases (cost §110).
