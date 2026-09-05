# Architecture

Pulse is a **serverless-first personal intelligence system**. There is no
GPU, no long-running worker daemon, no self-hosted database in the default
deployment. Everything runs on Vercel functions + Supabase Postgres + free
public data + a free-tier AI provider.

## Layering (strict separation, spec §110-6)

```
presentation   src/app/**, src/components/**      Next.js RSC pages + islands
read models    src/lib/queries.ts                 view models for pages
services       src/lib/news/**, ranking/**,        pipeline & scoring
               brief/**, notifications/**, search/**
ai             src/lib/ai/**, prompts/**           provider port + gate + prompts
persistence    src/lib/db/{repository,memory,pg}   storage port + 2 impls
config         config/pulse.config.ts              single config source
```

Dependencies point inward only: pages → queries → services → repository port.
No page ever imports a provider or the database directly.

## Storage port with graceful degradation

`Repository` is an interface (`src/lib/db/repository.ts`) with two
implementations:

- **PgRepository** — production. Plain `DATABASE_URL` (Supabase by default,
  provider-agnostic: Neon/Railway/self-host Postgres all work).
- **MemoryRepository** — demo/test fallback when `DATABASE_URL` is absent,
  seeded through the *real* pipeline so UI development needs no keys.

The singleton lives on `globalThis` because Next.js bundles server code per
route; a module-level promise would give pages and API routes two different
in-memory stores.

## Request flow

- **Pages** are React Server Components, `force-dynamic`, reading through
  `src/lib/queries.ts` view models (Today/Latest/Breaking/For You/Trending/
  Brief/Timeline/Saved/AI/OpenSource/Topics/Topic/Story/Sources/Settings).
- **API routes** (`/api/stories`, `/api/search`, `/api/save`, `/api/read`,
  `/api/brief`, `/api/admin/refresh`, `/api/health`, `/api/trending`,
  `/api/topics`) validate all inputs with Zod.
- **Cron routes** (`/api/cron/{fast,normal,daily}`) authenticate with
  `Authorization: Bearer $CRON_SECRET` and stay small and incremental — each
  run selects only sources past their refresh interval, processes bounded
  batches (jobs ≤ 20), and records `ingestion_runs` + `usage_events`.

## Jobs without a queue

There is no Redis/Kafka/BullMQ (cost spec §78). Async work (AI summaries,
notifications) is enqueued into the `ingestion_jobs` Postgres table and
claimed in batches of 20 by the same cron pass that created them.

## Failure containment

- Every provider fetch is isolated (`Promise.allSettled` + per-source try) —
  one dead feed can never fail a run.
- All outbound HTTP goes through `fetchWithRetry` (timeout, exponential
  backoff, Retry-After awareness).
- AI goes through the gate (`src/lib/ai/index.ts`): no key, over budget, or
  rate-limited ⇒ `null` ⇒ rule-based path. Never a crash, never auto-paid.

## Scale-out path (later, not MVP)

If cron load grows: move ingestion to a Cloudflare Worker Cron pushing into
the same Postgres; Vercel keeps UI/API. If semantic features justify it:
enable pgvector for embeddings/semantic search on the same database.
