# PULSE — Implementation Plan

Version: v1.0
Project: Pulse — Global Intelligence Feed
Authoritative sources:

- `Personal Global Intelligence Feed.md` (product / UI / architecture spec, v1.0)
- `PULSE — Cost & Information Source Strategy.md` (cost & data-source strategy, v2.0)

This plan converts the two specifications into executable milestones. Where the
two documents disagree, the cost strategy (v2.0) wins on architecture/cost
matters, and the product spec wins on product/UI matters.

---

## 0. Reconciled decisions (spec conflicts resolved)

| Topic | Product spec says | Cost spec says | Decision |
|---|---|---|---|
| Embeddings / semantic search | MVP includes semantic search, pgvector | No mandatory embedding for MVP; pgvector later | MVP ships Postgres FTS search. Search port has a `semantic` seam for pgvector in V2. Cluster/article embedding columns exist but stay nullable/unused. |
| Scheduler | Supabase Cron (pg_cron) | Vercel Cron first | Vercel Cron (`/api/cron/fast|normal|daily`) with `CRON_SECRET`. |
| Backend processes | `/workers` or `/src/jobs` | No persistent worker; jobs table | Postgres `ingestion_jobs` table + in-cron batch processing (limit 20). |
| Auth | Supabase Auth / GitHub OAuth | Simple secret login or GitHub OAuth | Optional simple secret login (`AUTH_SECRET` + `ALLOWED_EMAIL`). Off unless configured; absence must never break the app. |
| Self-host | Dockerfile + docker-compose required | Docker Compose is NOT MVP default | Both provided as "Deployment Mode B" (advanced option); Vercel+Supabase is Mode A and default. |
| AI provider | OPENAI_API_KEY listed | Gemini default, abstract provider | `AIProvider` port; `GeminiProvider` default; OpenAI-compatible optional. `AI_MODEL` configurable, never hard-coded. |

---

## 1. Constraints honored from cost spec §126 (all 40 rules)

Enforced by design review at the end of each milestone. Highlights wired into
code:

1. Vercel default deploy target, serverless-only, no GPU/self-host assumptions.
2. Supabase Postgres via plain `DATABASE_URL` (provider-agnostic).
3. Free data stack: RSS, GDELT, GitHub, HN, arXiv, official blogs (HF optional).
4. AI behind a port; app fully functional with AI unavailable (aggregator mode).
5. No AI for deterministic work (parsing, dedup, classification rules, scoring).
6. AI only on top clusters, cached by `cluster_hash + prompt_version + model`.
7. Cron routes are incremental, small, secret-protected.
8. No Redis/Kafka/queues — `ingestion_jobs` table, batch limit 20.
9. Telegram = realtime channel; Resend email = digest; both optional adapters.
10. Paid providers (`NewsAPIProvider`) implemented but `enabledByDefault=false`,
    hard-gated by `ALLOW_PAID_PROVIDERS=false` / `ALLOW_PAID_AI=false`.
11. Missing API keys never break boot or requests (graceful degradation).
12. Usage counters + Settings → System / Cost & Usage surfaces.
13. Retention jobs before any storage upgrade (daily cron cleanup).

## 2. Milestones

### M0 — Plan (this document) ✅

### M1 — Design + UI Shell (seeded, runnable)

- Next.js 16 + TypeScript strict + Tailwind v4 + Geist fonts.
- Design tokens exactly per spec §5–7 (light/dark CSS variables, category hint
  colors, typography scale, 220px sidebar / flexible main / 280px rail,
  1440px max width).
- Pages: `/` Today, `/latest`, `/trending`, `/for-you`, `/brief`, `/saved`,
  `/timeline`, `/ai`, `/open-source`, `/topics`, `/topic/[slug]`,
  `/story/[slug]`, `/sources`, `/settings` (+ sections), search/command menu
  (⌘K), mobile bottom nav + drawer, dark mode, skeletons, empty states.
- Deterministic seed data (50 articles, ≥10 clusters) run through the real
  normalize → dedup → classify → cluster → score pipeline.
- Acceptance: build/lint/typecheck/test green; visual pass in real browser.

### M2 — Database + Real Ingestion

- Drizzle schema per spec §26 tables; `drizzle-kit` migrations; seed script.
- Repository ports with two implementations: `PgRepository` (production) and
  `MemoryRepository` (no-`DATABASE_URL` demo/test fallback).
- Providers: RSS/Atom (ETag/Last-Modified caching), GDELT DOC, GitHub
  (releases + PRs, optional token), Hacker News (top/best/show), arXiv,
  Hugging Face (optional), NewsAPI (paid, disabled).
- Pipeline: canonical URL → dedup (URL, title tokens + time window) → rule
  classification + entities → clustering (token/entity/time) → importance /
  breaking / relevance / velocity scoring → jobs → AI summarize (guarded).
- Cron: `/api/cron/fast` (5 min: breaking RSS, GDELT, HN, GitHub),
  `/api/cron/normal` (hourly-ish: normal RSS, blogs, arXiv),
  `/api/cron/daily` (brief, digest, retention, metrics). All guarded by
  `CRON_SECRET`; `ingestion_runs` logging; per-source incremental scheduling.
- Acceptance: real news flows from public sources into the UI without any
  paid key; failing source never breaks the run (`Promise.allSettled`).

### M3 — Intelligence Layer

- `AIProvider` port (classify/summarize/synthesize/translate), Gemini default,
  structured JSON output, budget (`maxCallsPerHour/Day`), degradation to
  aggregator mode.
- Cluster summaries (`What happened / Why it matters / Key points`) with
  provenance ("Based on N reports", model + version stamped).
- Daily Brief (morning/evening) with sections + "Watch today"; rule-based
  fallback composition when AI is unavailable.
- Search: Postgres FTS (title/summary/source/category/topics) + memory
  fallback; `/api/search` grouped results; ⌘K modal.
- Notifications: Telegram breaking alerts (threshold ≥ 90, max 10/day, quiet
  hours), Resend email digest; both no-op without keys.
- Settings → System / Cost & Usage panels.
- Acceptance: unit tests green (URL normalization, dedup, classification,
  clustering, scoring, RSS parsing, budget, time); end-to-end pipeline test;
  browser E2E pass (home, search, story, save, settings).

### M4 — Deployment + Documentation

- `vercel.json` (3 cron groups), `.env.example`, `Dockerfile`,
  `docker-compose.yml` (Mode B), `README.md`, `docs/{ARCHITECTURE,
  NEWS_PIPELINE, AI_PIPELINE, DATABASE, DESIGN_SYSTEM, DEPLOYMENT,
  PROVIDERS}.md`, `robots` noindex, auth gate optional.
- Git init + push to GitHub (`gh`), then live browser verification.

## 3. Verification protocol (per spec §98.2)

Every milestone ends with: `npm run lint && npm run typecheck && npm run test
&& npm run build`. M1/M3 additionally get a real-browser pass (Chrome DevTools)
against the phase acceptance list. Final completion audit maps every
deliverable to evidence before the task is called done.
