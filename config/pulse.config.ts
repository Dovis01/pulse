import type { Category } from "@/lib/news/types";

/**
 * Central Pulse configuration (spec: config/pulse.config.ts).
 * Environment variables override where noted; no secrets live here.
 */
export const pulseConfig = {
  site: {
    name: process.env.NEXT_PUBLIC_SITE_NAME ?? "Pulse",
    tagline: process.env.NEXT_PUBLIC_SITE_TAGLINE ?? "Global Intelligence Feed",
    url: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  },

  /** DB stores UTC; frontend renders in this timezone by default. */
  timezone: process.env.APP_TIMEZONE ?? "Asia/Tokyo",

  refresh: {
    /** fast group cadence, minutes (Vercel cron) */
    fast: 5,
    /** normal group cadence, minutes */
    normal: 60,
    /** daily group cadence, hours */
    daily: 12,
  },

  ai: {
    enabled: process.env.AI_ENABLED !== "false",
    provider: process.env.AI_PROVIDER ?? "gemini",
    /** Never hard-code a model name; provider default applies when empty. */
    model: process.env.AI_MODEL ?? "",
    /** Free-tier guards — tuned to current provider quotas. */
    maxCallsPerHour: 50,
    maxCallsPerDay: 500,
    /** Max cluster summaries generated per ingestion run. */
    maxSummariesPerRun: 5,
    /** Minimum cluster importance before AI summarization. */
    summarizeThreshold: 55,
    /** Min sources in a cluster before it deserves a synthesis. */
    minSourcesForSummary: 1,
  },

  categories: [
    "AI",
    "Technology",
    "OpenSource",
    "Markets",
    "Business",
    "World",
    "Science",
    "Cybersecurity",
  ] as Category[],

  /** GitHub personal watchlist (spec §78). */
  github: {
    repositories: [
      "sgl-project/sglang",
      "huggingface/transformers",
      "vllm-project/vllm",
      "pytorch/pytorch",
      "flashinfer-ai/flashinfer",
    ],
  },

  /** GDELT discovery query — global radar, not a body source. */
  gdelt: {
    query:
      '(artificial intelligence OR "large language model" OR semiconductor OR cybersecurity) sourcelang:english',
    timespan: "1h",
    maxRecords: 50,
  },

  interests: [
    { topic: "Artificial Intelligence", weight: 1.0 },
    { topic: "LLM", weight: 1.0 },
    { topic: "Open Source", weight: 1.0 },
    { topic: "SGLang", weight: 1.0 },
    { topic: "Semiconductors", weight: 0.8 },
    { topic: "Technology", weight: 0.7 },
    { topic: "Cybersecurity", weight: 0.6 },
    { topic: "Markets", weight: 0.5 },
    { topic: "World", weight: 0.4 },
    { topic: "Science", weight: 0.4 },
    { topic: "Sports", weight: 0.1 },
  ],

  notifications: {
    /** Breaking alert threshold on importance score. */
    breakingMinImportance: 90,
    /** Never more than this many alerts per day. */
    maxAlertsPerDay: 10,
    /** Quiet hours in app timezone — no alerts in between. */
    quietHours: { start: "23:00", end: "08:00" },
    digestHours: [8, 19],
  },

  /** Scores / pipelines. */
  scoring: {
    breakingThreshold: 85,
    forYouMinRelevance: 30,
    clusterTimeWindowHours: 72,
    clusterTokenThreshold: 0.32,
    dedupTokenThreshold: 0.7,
    dedupTimeWindowHours: 72,
  },

  /** Retention (days) — free-tier storage discipline. */
  retention: {
    rawContentDays: 7,
    articleDays: 365,
    runDays: 30,
    jobDays: 7,
  },

  search: {
    initialLimit: 30,
  },
} as const;

export type PulseConfig = typeof pulseConfig;
