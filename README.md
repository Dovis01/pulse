# PULSE

**Global Intelligence Feed** — a personal, serverless-first news intelligence system.

> Less Noise. More Signal.

Pulse ingests the world's free information sources (RSS, GDELT, GitHub, Hacker
News, arXiv, official AI-lab blogs), deduplicates and clusters coverage into
single events, scores them by importance and personal relevance, synthesizes
AI summaries only where they add value, and presents everything in a minimal,
high-density editorial dashboard.

It is **not** an RSS reader, not a news portal, not a feed waterfall. It is a
personal intelligence terminal: *Collect → Filter → Cluster → Understand →
Prioritize → Present.*

---

## Screenshots

Run locally and open `http://localhost:3000` — the Today page leads with a
Global Brief, Breaking, Top Stories (ranked by importance), For You, and
category sections, with a right-hand intelligence rail (What changed /
Trending / Live wire).

```
PULSE /                                        Search ⌘K   20:42 Tokyo
────────────────────────────────────────────────────────────────────────
SIDEBAR          │  GOOD MORNING. HERE IS WHAT MATTERS TODAY.   │ WHAT CHANGED
Overview         │  GLOBAL BRIEF …                              │ SINCE 08:00
Topics           │  ── TOP STORIES (by importance) ──           │ +14 major
Intelligence     │  01  AI   Story headline …         92        │ TRENDING
System           │  02  WORLD  Story headline …       87        │ 01 NVIDIA ↑31%
                 │  ── FOR YOU ──  ── AI & TECH ── …             │ LIVE
Last sync 20:42  │                                              │ Reuters · GitHub
● Live           │                                              │ BBC · CNBC
```

---

## Architecture

```
RSS ─ GDELT ─ GitHub ─ HN ─ arXiv ─ Official blogs     (free sources, $0)
        │
        ▼
  VERCEL CRON  →  /api/cron/fast|normal|daily          (incremental, secret-guarded)
        ▼
  NORMALIZE → URL DEDUP → TITLE DEDUP → RULE CLASSIFY
        ▼
  STORY CLUSTERING (tokens + entities + time)
        ▼
  IMPORTANCE / BREAKING / RELEVANCE SCORING            (pure code, no AI)
        ▼
  AI SUMMARY — only top clusters, budget-capped        (Gemini free tier)
        ▼
  SUPABASE POSTGRES  (or any Postgres via DATABASE_URL)
        ▼
  Next.js UI  ·  Telegram alerts  ·  Resend digest
```

Full details: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) ·
[docs/NEWS_PIPELINE.md](docs/NEWS_PIPELINE.md) · [docs/AI_PIPELINE.md](docs/AI_PIPELINE.md)

**Cost posture: $0/month.** Every provider is free-tier; paid providers
(NewsAPI, OpenAI) ship disabled behind `ALLOW_PAID_PROVIDERS=false` /
`ALLOW_PAID_AI=false` and never auto-enable. A missing API key degrades the
feature, never the app.

---

## Quick Start

```bash
npm install
npm run dev            # http://localhost:3000 — demo mode, seeded data
```

No configuration required: without `DATABASE_URL` Pulse runs on an in-memory
store seeded through the real pipeline, so the UI is fully explorable.

To pull **real news** immediately:

```bash
curl -X POST http://localhost:3000/api/admin/refresh
```

Bring your own database (recommended for anything beyond a demo):

```bash
cp .env.example .env   # set DATABASE_URL (Supabase connection string)
npm run db:generate    # (already committed) generate SQL migrations
npm run db:migrate     # apply them
npm run db:seed        # optional sample corpus
```

---

## Environment Variables

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | no | Postgres (Supabase recommended). Absent → demo mode. |
| `NEXT_PUBLIC_APP_URL` | no | Canonical URL used in links/notifications. |
| `APP_TIMEZONE` | no | Display timezone (default `Asia/Tokyo`). DB stays UTC. |
| `CRON_SECRET` | prod | Bearer secret for `/api/cron/*` routes. |
| `AI_ENABLED` / `AI_PROVIDER` / `AI_MODEL` | no | AI gate; default `gemini`, model never hard-coded. |
| `GEMINI_API_KEY` | no | Free-tier Gemini summaries/briefs. |
| `GITHUB_TOKEN` | no | Raises GitHub API rate limits (anonymous works). |
| `HF_TOKEN` | no | Optional Hugging Face source. |
| `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID` | no | Breaking alerts (primary realtime channel). |
| `RESEND_API_KEY` / `EMAIL_FROM` / `EMAIL_TO` | no | Daily-brief email digest. |
| `AUTH_SECRET` / `ALLOWED_EMAIL` | no | Optional single-user login gate. |
| `ALLOW_PAID_PROVIDERS` / `ALLOW_PAID_AI` | no | Cost guards — keep `false`. |
| `NEWS_API_KEY` | no | Paid news API; **disabled by default**. |

Every key is optional. No key may break startup or requests.

---

## News Providers

| Provider | Cost | Group | Role |
|---|---|---|---|
| RSS / Atom (BBC, Al Jazeera, TechCrunch, The Verge, Ars Technica, CNBC, VentureBeat, Hacker News RSS…) | $0 | fast/normal | Core headlines + metadata |
| GDELT DOC 2.0 | $0 | fast | Global radar, cross-country discovery |
| GitHub REST (watchlist: sglang, transformers, vllm, pytorch, flashinfer) | free tier | fast | Releases + merged PRs intelligence |
| Hacker News (top/best/show) | $0 | fast | Developer community velocity |
| Official blogs (OpenAI, Anthropic, DeepMind, Meta AI, HF, GitHub, Cloudflare, NVIDIA, MSR) | $0 | normal | First-party, authority 88–95 |
| arXiv (cs.AI/CL/LG/DC/CR) | $0 | normal | Research |
| Hugging Face Hub | free tier | normal | Model releases (**off by default**) |
| NewsAPI | paid | — | Implemented, `enabledByDefault=false` |

Details: [docs/PROVIDERS.md](docs/PROVIDERS.md)

---

## AI Setup

1. Create a free Gemini API key (Google AI Studio).
2. Set `GEMINI_API_KEY=…` (optionally `AI_MODEL=gemini-2.0-flash`).
3. Done. Cluster summaries and the Daily Brief now use AI — guarded by
   50 calls/hour, 500/day, cached per `cluster_hash + prompt_version + model`,
   regenerated only when the cluster materially changes.

Without a key (or after quota exhaustion) Pulse stays fully functional in
**aggregator mode**: titles, descriptions, rule categories, scores and a
rule-composed Daily Brief. See [docs/AI_PIPELINE.md](docs/AI_PIPELINE.md).

---

## Vercel Deployment (Mode A — default)

1. Push this repo to GitHub.
2. Import it on Vercel — `vercel.json` already registers the cron groups:
   - `/api/cron/fast` every 5 min (breaking RSS, GDELT, HN, GitHub)
   - `/api/cron/normal` hourly (blogs, arXiv)
   - `/api/cron/daily` at 07:30 & 18:30 (brief, digest, retention)
3. Add env vars (`DATABASE_URL` from Supabase, `CRON_SECRET`, optional keys).
4. Run `npm run db:migrate && npm run db:seed` once against Supabase.

## Docker Deployment (Mode B — self-host)

```bash
cp .env.example .env   # optional keys
docker compose up -d   # web + postgres + ingestion loop
```

Details: [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)

---

## Adding Sources

All feeds live in the registry — never in page components:

```ts
// src/lib/news/registry.ts
{
  id: "rss-my-source",
  name: "My Source",
  type: "rss",                      // "rss" | "api" | "official"
  url: "https://example.com/feed.xml",
  provider: "rss",
  category: "Technology",
  authorityScore: 78,               // 20–95, drives importance
  enabled: true,
  refreshIntervalMinutes: 15,
  group: "fast",                    // cron group
}
```

Toggle sources at runtime in **Settings → Sources**.

---

## Development

```bash
npm run dev          # dev server
npm run lint         # eslint (flat config)
npm run typecheck    # tsc --noEmit (strict)
npm run test         # vitest — 51 tests across the pipeline
npm run build        # production build
npm run db:generate  # regenerate migrations after schema changes
```

Stack: Next.js 16 · TypeScript strict · Tailwind v4 · Drizzle ORM ·
Postgres/Supabase · Zod · fast-xml-parser · Geist. Layout/design rules live in
[docs/DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md); schema in
[docs/DATABASE.md](docs/DATABASE.md).

---

*Collect cheaply. Filter aggressively. Store selectively. Call AI
intelligently. Pay only when value is proven.*
