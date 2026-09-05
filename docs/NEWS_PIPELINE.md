# News Pipeline

```
Sources → Collectors → Normalize → URL canonicalization → Language hint
        → Deduplication (L1 URL, L2 title-tokens+time) → Rule classification
        + entity extraction → Story clustering (tokens + entities + time)
        → Importance / breaking / velocity / relevance scoring
        → AI summarization (top clusters only) → Database → UI
```

## Orchestration

`runIngestion(group)` in `src/lib/news/ingest.ts` drives a pass:

1. `selectDueSources` — only sources in the cron group whose
   `refreshIntervalMinutes` have elapsed (incremental; nothing is re-fetched
   early).
2. Sources grouped by provider; `fetchProviders` fans out per provider with
   per-source isolation.
3. Each incoming item:
   - canonical URL (`canonicalizeUrl`: strips utm/fbclid/…, drops fragment,
     sorts params, https + no-www normalization)
   - dedup L1 (exact canonical URL) and L2 (Jaccard title-token similarity ≥
     0.7 within 72h) against recent store contents
   - rule classification + entity extraction (keyword dictionaries, entity
     weights; AI fallback is intentionally *not* wired for MVP)
   - importance pre-score; insert; taxonomy recorded
   - cluster attachment: compare against active clusters (title tokens +
     entity overlap inside the window), join best match or open a new
     cluster, then `recomputeCluster` re-derives aggregates
4. Important clusters (importance ≥ 55) without fresh summaries enqueue
   `summarize-cluster` jobs; `processJobs` claims ≤ 20.
5. `processBreakingAlerts` evaluates Telegram alerts (threshold ≥ 90, ≤ 10/
   day, quiet hours, once per cluster).

Every step is logged into `ingestion_runs` (fetched/created/duplicates/
failed/error) and `usage_events`.

## Cron groups (cost spec §69–72)

| Route | Cadence (vercel.json) | Sources |
|---|---|---|
| `/api/cron/fast` | */5 min | breaking RSS wires, GDELT radar, HN, GitHub watchlist |
| `/api/cron/normal` | hourly | official blogs, normal RSS, arXiv, HF |
| `/api/cron/daily` | 07:30 & 18:30 | Daily Brief, email digest, retention cleanup |

## Scoring

- **Importance** = 0.25·sourceAuthority + 0.25·sourceCount(log-saturated) +
  0.20·velocity + 0.15·entityImportance + 0.10·geoSpread + 0.05·recency.
- **Breaking** = 0.30·velocity + 0.25·sourceDiversity + 0.20·authority +
  0.15·recency(fast decay) + 0.10·crossRegion; > 85 ⇒ Breaking.
- **Relevance** = keyword/topic/entity affinity to the interest profile ×
  weights (pure code, spec §116); For You = importance·0.55 + relevance·0.45.
- **Trending** = current-window mentions vs trailing-week baseline (per-window
  scaled); ≠ importance.

## Retention

Daily cron prunes: raw content > 7d, articles > 365d (saved exempt), runs >
30d, finished jobs > 7d — store selectively, upgrade storage last (cost §110).
