# AI Pipeline

**Principle: AI only after filtering, and always behind an abstraction.**
Deterministic work (parsing, dedup, classification rules, scoring, sorting)
never touches an LLM (cost spec §55). AI is reserved for synthesis.

## Provider port

```ts
interface AIProvider {
  summarizeCluster(input): Promise<ClusterSummaryResult>;
  synthesizeBrief(input): Promise<BriefSynthesis>;
  classify(input): Promise<ClassifyResult>;
  translate(text, target): Promise<string>;
}
```

- `GeminiProvider` — default (`AI_PROVIDER=gemini`, `GEMINI_API_KEY`,
  `AI_MODEL` configurable; free tier).
- `OpenAIProvider` — optional, **requires `ALLOW_PAID_AI=true`** (no free
  tier; never auto-enabled).

Business code never imports a provider — it calls `callAI(fn)`.

## Gate & budget (`src/lib/ai/index.ts`)

Before any call the gate checks: AI enabled? provider credentials present?
hourly budget (50) and daily budget (500) unspent? not in rate-limit cooldown?
Any failure ⇒ `null`, and callers fall back to the rule path:

- cluster summary → `Summary` section composed from cluster metadata
- Daily Brief → `composeRuleBasedBrief` editorial fallback
- **aggregator mode** overall: titles, descriptions, categories, scores

`AIRateLimitError` (429/503) trips a 15-minute cooldown, mirroring the
degradation ladder: reduce → cache → skip → inform (cost §107–109).

## Where AI is spent

| Task | Trigger | Budget impact |
|---|---|---|
| Cluster summary (What happened / Why it matters / Key points) | cluster importance ≥ 55, no fresh summary | per top cluster, capped per run |
| Daily Brief synthesis (intro + sections + watch) | daily cron 07:30/18:30 | ~2 calls/day |
| Translation (zh) | future — important stories only | — |

Typical day: a few dozen calls at most — never one per article.

## Caching & regeneration

Summaries are stored with `cluster_hash` (membership fingerprint) +
`summary_model` + `summary_version`. A cluster whose hash is unchanged and
which already has a current-version summary is **never** regenerated.
Regeneration happens only on: material membership change, prompt version
bump, or manual refresh.

## Structured output

All prompts (versioned in `prompts/`) demand JSON with a fixed schema and
are parsed as JSON — never free-form text scraping (spec §32). Every AI
summary in the UI is labeled **AI-generated** with model, prompt version and
generation time, and always sits above the full source list (source
transparency, spec §15/§66).
