# Deployment

> **Live (Mode A):** <https://pulse-dovis01s-projects.vercel.app> —
> Vercel Hobby (dovis01) + Neon free Postgres (`neon-aqua-apple`, Singapore),
> scheduled by GitHub Actions (public repo, free). Deployment Protection
> (Vercel Authentication) is disabled so the personal feed is reachable
> without a Vercel login; re-enable it in the dashboard for a locked-down
> instance. Hobby cron limits scheduling to once/day, so high-frequency
> groups run via `.github/workflows/pulse-cron.yml` (fast */15, normal
> hourly, daily brief 07:30 & 18:00 JST) — secrets `PULSE_URL` and
> `PULSE_CRON_SECRET` drive the same CRON_SECRET-guarded endpoints.


## Mode A — Vercel + Supabase (default)

```
Vercel (Hobby)  →  UI + API routes + Cron
Supabase (Free) →  Postgres
```

1. **Database** — create a Supabase project, copy the connection string
   (Session pooler URI) into `DATABASE_URL`.
2. **Migrate + seed** — `npm run db:migrate && npm run db:seed` once
   (locally with the env var set, or via Supabase SQL editor using
   `db/migrations/0000_*.sql`).
3. **Import repo on Vercel** — framework auto-detected; `vercel.json`
   registers:

   | Route | Schedule | Work |
   |---|---|---|
   | `/api/cron/fast` | `*/5 * * * *` | breaking RSS, GDELT, HN, GitHub |
   | `/api/cron/normal` | `23 * * * *` | blogs, arXiv, HF |
   | `/api/cron/daily` | `30 7,18 * * *` | brief, digest, cleanup |

4. **Environment** — set `DATABASE_URL`, `CRON_SECRET` (Vercel Cron then
   sends `Authorization: Bearer …` automatically), plus any optional keys
   (`GEMINI_API_KEY`, `TELEGRAM_*`, `RESEND_*`, `GITHUB_TOKEN`).
5. **Verify** — `GET /api/health` → `{"ok":true,"mode":"postgres"}`; hit
   `POST /api/admin/refresh` from the ⌘K menu and watch stories appear.

Cron routes run incrementally: each invocation only processes sources past
their refresh interval in bounded batches — sized for serverless limits.

## Mode B — Docker Compose (self-host, advanced)

```bash
cp .env.example .env
docker compose up -d        # web (standalone Next) + postgres + ingestion loop
```

The `worker` service is a curl loop driving the same `/api/cron/*` routes
with `CRON_SECRET` — the pipeline itself is identical (no separate worker
codebase). Redis is intentionally absent.

## Operational notes

- **Auth (optional)**: set `AUTH_SECRET` (+ `ALLOWED_EMAIL`) to require a
  single-user secret login; unset = open personal instance.
- **robots**: the app serves `noindex` for personal deployments (spec §59).
- **Monitoring**: no Datadog/New Relic (cost §96). Settings → System shows
  DB mode, AI state, channel health, last cron/fetch, source failures; Cost
  & Usage shows daily/monthly counters and an estimated $0.00 paid usage.
- **Scaling path**: if cron load grows, move ingestion to a Cloudflare
  Worker Cron writing into the same Postgres; Vercel keeps UI/API only.
