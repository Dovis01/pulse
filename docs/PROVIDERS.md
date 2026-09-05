# Providers

All sources are registered in `src/lib/news/registry.ts` and fetched through
the `NewsProvider`/`DataProvider` adapters in `src/lib/news/providers/`.
Nothing is ever hard-coded in a page (cost spec §11). Every provider has
`costType` metadata; paid providers are `enabledByDefault: false` and
hard-gated.

## Registry entry

```ts
interface NewsSource {
  id, name, type: "rss"|"api"|"official",
  url, provider, category,
  language?, country?,
  authorityScore,          // 20–95, feeds importance (§29)
  enabled,
  refreshIntervalMinutes,  // incremental scheduling
  group: "fast"|"normal",  // cron group
  metadata?,               // ETag / Last-Modified cache
}
```

## Bundled providers

| Adapter | Cost | Notes |
|---|---|---|
| `rss.ts` | free | RSS 2.0 + Atom; conditional GETs (ETag/Last-Modified → 304 skip); media/enclosure images |
| `gdelt.ts` | free | DOC 2.0 artlist; global radar query, 1h timespan, 75 records |
| `github.ts` | free tier | watchlist releases + recently merged PRs (48h window); `GITHUB_TOKEN` optional; per-repo isolation |
| `hackernews.ts` | free | top/best/show, 12 each; points & comments kept as metadata |
| `arxiv.ts` | free | Atom API, cs.AI/CL/LG/DC/CR, newest 40 |
| `huggingface.ts` | free tier | trending + new models; anonymous OK, `HF_TOKEN` optional; **off by default** |
| `newsapi.ts` | paid | implemented but inert unless `ALLOW_PAID_PROVIDERS=true` **and** `NEWS_API_KEY` set |

## Cross-cutting behavior

- **HTTP**: `fetchWithRetry` — 12–20s timeout, ≤2 retries, exponential
  backoff (1s/2s/4s), `Retry-After` honored on 429/503.
- **Isolation**: per-source try/catch inside `Promise.allSettled` — a dead
  feed logs an `ingestion_runs.error` and never fails the batch.
- **Caching**: RSS conditional headers stored in `sources.metadata`;
  `304 Not Modified` = zero reprocessing.
- **Usage accounting**: GitHub/HF requests recorded to `usage_events` and
  surfaced in Settings → Cost & Usage.

## Adding a source

Append to `DEFAULT_SOURCES` (or toggle at runtime in Settings → Sources).
Set a sane `refreshIntervalMinutes` (fast news 5–10, blogs 30, research
60–180) and an honest authority score. To add a *new protocol*, implement a
provider module exporting `fetch(source) → RawArticle[]`, register it in
`providers/index.ts`, and add its id to `ProviderId`.
