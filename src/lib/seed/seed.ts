import { pulseConfig } from "@config/pulse.config";
import { classifyRules } from "@/lib/news/classify";
import { clusterHash, mergeClusterMeta, pickCanonicalTitle } from "@/lib/news/clustering";
import { articleIdentity, detectLanguage, slugify, truncate } from "@/lib/news/normalize";
import { DEFAULT_SOURCES } from "@/lib/news/registry";
import type { Article, StoryCluster, UserInterest } from "@/lib/news/types";
import { computeBreakingScore } from "@/lib/ranking/breaking";
import { computeImportance, entityImportanceScore, normalizeSourceCount } from "@/lib/ranking/importance";
import { computeRelevance } from "@/lib/ranking/relevance";
import { clusterVelocity } from "@/lib/ranking/velocity";
import type { Repository } from "@/lib/db/repository";

/**
 * Seed data generator (product spec §101): 50 articles across ≥10 story
 * clusters, multiple categories and timestamps. Runs the REAL pipeline
 * (classify → cluster → score) so demo data exercises production code.
 * Deterministic PRNG — stable output across runs.
 */

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

interface SeedEvent {
  clusterTitles: string[];
  category: Article["category"];
  sourceIds: string[];
  country?: string;
  entity: string;
  hoursAgo: number;
}

const SOURCE_BY_ID = new Map(DEFAULT_SOURCES.map((s) => [s.id, s]));

const EVENTS: SeedEvent[] = [
  {
    clusterTitles: [
      "NVIDIA announces next-generation Rubin Ultra AI platform",
      "Nvidia unveils Rubin Ultra architecture for AI data centers",
      "NVIDIA reveals Rubin Ultra chips as AI infrastructure race intensifies",
    ],
    category: "AI",
    sourceIds: ["rss-techcrunch", "rss-verge", "rss-cnbc-markets", "rss-nvidia-blog"],
    entity: "nvidia",
    hoursAgo: 2,
  },
  {
    clusterTitles: [
      "OpenAI releases new reasoning model with major benchmark gains",
      "OpenAI introduces upgraded reasoning model for developers",
      "OpenAI's latest model sets new records on math and coding benchmarks",
    ],
    category: "AI",
    sourceIds: ["rss-venturebeat-ai", "rss-techcrunch", "rss-openai-blog"],
    entity: "openai",
    hoursAgo: 5,
  },
  {
    clusterTitles: [
      "SGLang v0.5 released with 2x faster inference scheduler",
      "SGLang project ships major release improving LLM serving throughput",
      "v0.5 of the SGLang inference engine lands with new scheduler",
    ],
    category: "OpenSource",
    sourceIds: ["github-watchlist", "hn-top"],
    entity: "sglang",
    hoursAgo: 8,
  },
  {
    clusterTitles: [
      "Federal Reserve signals slower pace of rate cuts",
      "Fed hints at cautious approach ahead as inflation cools",
      "Central bank officials split on timing of next rate move",
    ],
    category: "Markets",
    sourceIds: ["rss-cnbc-markets", "rss-aljazeera", "rss-bbc-world"],
    entity: "fed",
    hoursAgo: 3,
  },
  {
    clusterTitles: [
      "Major ransomware attack disrupts European logistics operator",
      "Cyberattack forces logistics firm offline across three countries",
      "Ransomware group claims responsibility for logistics breach",
    ],
    category: "Cybersecurity",
    sourceIds: ["rss-the-hacker-news", "rss-bbc-world", "rss-ars-technica"],
    country: "DE",
    entity: "ransomware",
    hoursAgo: 6,
  },
  {
    clusterTitles: [
      "TSMC reports record quarterly revenue on AI chip demand",
      "TSMC quarterly results beat estimates as AI demand surges",
      "Chipmaker TSMC sees no slowdown in advanced node orders",
    ],
    category: "Technology",
    sourceIds: ["rss-cnbc-markets", "rss-techcrunch"],
    country: "TW",
    entity: "tsmc",
    hoursAgo: 10,
  },
  {
    clusterTitles: [
      "vLLM adds speculative decoding support in new release",
      "vLLM project merges speculative decoding after months of testing",
      "Latest vLLM release promises cheaper LLM inference",
    ],
    category: "OpenSource",
    sourceIds: ["github-watchlist", "hn-top"],
    entity: "vllm",
    hoursAgo: 20,
  },
  {
    clusterTitles: [
      "Anthropic expands enterprise Claude offering with new controls",
      "Anthropic launches enterprise features for Claude deployments",
      "Claude gains compliance controls as Anthropic courts business",
    ],
    category: "AI",
    sourceIds: ["rss-anthropic-news", "rss-venturebeat-ai"],
    entity: "anthropic",
    hoursAgo: 14,
  },
  {
    clusterTitles: [
      "DeepSeek open-sources compact model rivaling larger systems",
      "DeepSeek releases small model with outsized benchmark results",
      "New DeepSeek model challenges assumptions about model size",
    ],
    category: "AI",
    sourceIds: ["rss-venturebeat-ai", "hn-top", "rss-techcrunch"],
    entity: "deepseek",
    hoursAgo: 26,
  },
  {
    clusterTitles: [
      "Typhoon approaches Japan forcing flight cancellations",
      "Japan braces as powerful typhoon nears main island",
      "Thousands evacuated along Japanese coast ahead of storm",
    ],
    category: "World",
    sourceIds: ["rss-aljazeera", "rss-bbc-world"],
    country: "JP",
    entity: "japan",
    hoursAgo: 4,
  },
  {
    clusterTitles: [
      "Astronomers detect atmosphere on nearby exoplanet",
      "Telescope observations reveal exoplanet atmosphere details",
      "Nearby exoplanet shows signs of a thick atmosphere",
    ],
    category: "Science",
    sourceIds: ["rss-ars-technica"],
    entity: "nasa",
    hoursAgo: 30,
  },
  {
    clusterTitles: [
      "EU agrees landmark rules on artificial intelligence enforcement",
      "European Union finalizes AI act enforcement details",
      "Blockbuster EU deal sets guardrails for AI deployment",
    ],
    category: "Business",
    sourceIds: ["rss-aljazeera", "rss-verge"],
    country: "BE",
    entity: "eu",
    hoursAgo: 40,
  },
];

const SINGLE_ARTICLES: {
  title: string;
  sourceId: string;
  category: Article["category"];
  hoursAgo: number;
  description: string;
}[] = [
  { title: "PyTorch 3.0 roadmap discussion opens in RFC", sourceId: "github-watchlist", category: "OpenSource", hoursAgo: 12, description: "Maintainers propose unified compile path and new dispatcher layout." },
  { title: "Hugging Face trending models highlight efficient LLMs", sourceId: "rss-hf-blog", category: "AI", hoursAgo: 9, description: "Small reasoning models dominate weekly downloads." },
  { title: "arXiv: efficient KV-cache compression for long context", sourceId: "arxiv-cs", category: "Science", hoursAgo: 16, description: "Researchers describe 4x memory reduction for 1M-token contexts." },
  { title: "Cloudflare outage briefly hits parts of Europe", sourceId: "rss-cloudflare-blog", category: "Technology", hoursAgo: 7, description: "A routing configuration error caused a 22-minute degradation." },
  { title: "Hacker News: Show HN — terminal dashboard for inference clusters", sourceId: "hn-top", category: "Technology", hoursAgo: 11, description: "A lightweight TUI for GPU utilization tracking gains traction." },
  { title: "Microsoft Research open-sources evaluation harness", sourceId: "rss-microsoft-research", category: "Science", hoursAgo: 22, description: "The harness standardizes multilingual benchmarking of LLMs." },
  { title: "AMD previews next data center GPU line", sourceId: "rss-venturebeat-ai", category: "Technology", hoursAgo: 18, description: "Roadmap points at higher memory bandwidth for inference." },
  { title: "Bitcoin slips as traders digest Fed remarks", sourceId: "rss-cnbc-markets", category: "Markets", hoursAgo: 5, description: "Crypto markets reversed early gains after the statement." },
  { title: "GitHub expands code scanning default for new repos", sourceId: "rss-github-blog", category: "OpenSource", hoursAgo: 28, description: "New repositories get secret scanning enabled by default." },
  { title: "Study links sleep regularity to cognitive health", sourceId: "rss-ars-technica", category: "Science", hoursAgo: 34, description: "A five-year cohort study adds to the evidence base." },
  { title: "NVIDIA partners with industrial robotics maker", sourceId: "rss-nvidia-blog", category: "Technology", hoursAgo: 45, description: "Simulation stack will power factory digital twins." },
  { title: "Anthropic details constitutional tuning update", sourceId: "rss-anthropic-news", category: "AI", hoursAgo: 50, description: "Paper describes reduced refusal rates without safety loss." },
  { title: "EU negotiators agree platform competition rules", sourceId: "rss-aljazeera", category: "Business", hoursAgo: 55, description: "New rules target app store payment practices." },
  { title: "Zero-day exploited at network edge vendors", sourceId: "rss-the-hacker-news", category: "Cybersecurity", hoursAgo: 13, description: "Patch guidance issued for edge gateway appliances." },
  { title: "Apple silicon event expected next month", sourceId: "rss-verge", category: "Technology", hoursAgo: 60, description: "Invites point to an AI-focused hardware refresh." },
];

export interface SeedResult {
  articles: Article[];
  clusters: StoryCluster[];
  interests: UserInterest[];
}

export function buildSeedData(now = new Date()): SeedResult {
  const rand = mulberry32(20260904);
  const articles: Article[] = [];
  const clusters: StoryCluster[] = [];

  let counter = 0;
  const nextId = () => `seed-${(counter += 1)}-${Math.floor(rand() * 1e6).toString(16)}`;

  const makeArticle = (
    title: string,
    description: string,
    sourceId: string,
    publishedAt: Date,
    content?: string,
  ): Article | null => {
    const source = SOURCE_BY_ID.get(sourceId);
    if (!source) return null;
    const identity = articleIdentity({
      url: `https://example.com/pulse-seed/${slugify(title, nextId())}`,
      title,
      publishedAt,
      sourceId,
      sourceName: source.name,
    });
    const classified = classifyRules(`${title}. ${description}`, source.category);
    const id = nextId();
    return {
      id,
      sourceId,
      sourceName: source.name,
      sourceAuthority: source.authorityScore,
      sourceProvider: source.provider,
      url: identity.canonicalUrl,
      canonicalUrl: identity.canonicalUrl,
      title,
      description,
      content: truncate(content ?? `${description} Pulse seed content for development.`),
      language: detectLanguage(title, source.language),
      country: source.country,
      category: classified.category,
      topics: classified.topics,
      entities: classified.entities,
      tags: [],
      publishedAt: publishedAt.toISOString(),
      fetchedAt: publishedAt.toISOString(),
      importanceScore: 0,
      relevanceScore: 0,
      velocityScore: 0,
    };
  };

  // Clustered events: variants share an event with distinct wording.
  for (const event of EVENTS) {
    const clusterArticles: Article[] = [];
    event.clusterTitles.forEach((title, i) => {
      const publishedAt = new Date(now.getTime() - (event.hoursAgo - i * 0.7) * 3_600_000);
      const a = makeArticle(
        title,
        `${event.entity.replace(/\b\w/g, (c) => c.toUpperCase())} development — variant ${i + 1} of the ongoing story, reported with additional detail and reaction.`,
        event.sourceIds[i % event.sourceIds.length]!,
        publishedAt,
      );
      if (a) {
        a.country = event.country ?? a.country;
        clusterArticles.push(a);
        articles.push(a);
      }
    });
    if (clusterArticles.length === 0) continue;

    const meta = mergeClusterMeta(clusterArticles);
    const clusterId = nextId();
    for (const a of clusterArticles) a.clusterId = clusterId;

    const hoursSince = (now.getTime() - Math.min(...clusterArticles.map((a) => new Date(a.publishedAt).getTime()))) / 3_600_000;
    const velocity = clusterVelocity(clusterArticles, now);
    const importance = computeImportance({
      sourceAuthority: Math.max(...clusterArticles.map((a) => a.sourceAuthority)),
      sourceCount: clusterArticles.length,
      velocity,
      entityImportance: entityImportanceScore(meta.entities),
      geoCount: meta.countries.length,
      hoursSinceUpdate: hoursSince,
    });
    const breaking = computeBreakingScore({
      articlesPerHour: velocity,
      distinctSources: clusterArticles.length,
      maxAuthority: Math.max(...clusterArticles.map((a) => a.sourceAuthority)),
      hoursSinceFirstSeen: hoursSince,
      distinctCountries: meta.countries.length,
    });

    const cluster: StoryCluster = {
      id: clusterId,
      canonicalTitle: pickCanonicalTitle(clusterArticles),
      slug: slugify(meta.entities[0] ?? meta.category, clusterId),
      ...meta,
      importanceScore: importance,
      breakingScore: breaking,
      velocityScore: Math.round(velocity),
      relevanceScore: 0,
      sourceCount: clusterArticles.length,
      firstSeenAt: clusterArticles[clusterArticles.length - 1]!.publishedAt,
      lastUpdatedAt: clusterArticles[0]!.publishedAt,
      isBreaking: breaking > pulseConfig.scoring.breakingThreshold,
      clusterHash: clusterHash(clusterArticles.map((a) => a.id)),
      summaryShort: undefined,
    };
    clusters.push(cluster);
  }

  // Singles.
  for (const single of SINGLE_ARTICLES) {
    const publishedAt = new Date(now.getTime() - single.hoursAgo * 3_600_000);
    const a = makeArticle(single.title, single.description, single.sourceId, publishedAt);
    if (a) articles.push(a);
  }

  // Fill to exactly 50 articles with filler signal items.
  const FILLER = [
    ["Markets close mixed as tech shares steady", "rss-cnbc-markets", "Markets"],
    ["Anthropic research blog examines interpretability", "rss-anthropic-news", "AI"],
    ["Open-source maintainers survey shows burnout trends", "rss-github-blog", "OpenSource"],
    ["Edge inference hardware roundup gains new entrants", "rss-ars-technica", "Technology"],
    ["UN climate summit previews finance agenda", "rss-aljazeera", "World"],
    ["arXiv survey reviews agentic evaluation methods", "arxiv-cs", "Science"],
    ["Vulnerability disclosures rise across OSS packages", "rss-the-hacker-news", "Cybersecurity"],
    ["Venture funding for AI infra firms stays robust", "rss-techcrunch", "Business"],
    ["Data center power constraints shape buildouts", "rss-verge", "Technology"],
    ["OpenAI developer forum highlights agent tooling", "rss-openai-blog", "AI"],
    ["PyTorch foundation reports growing contributor base", "github-watchlist", "OpenSource"],
    ["Analysts weigh semiconductor cycle duration", "rss-cnbc-markets", "Markets"],
    ["Quantum error correction milestone reported", "rss-microsoft-research", "Science"],
    ["Phishing kits target developer communities", "rss-the-hacker-news", "Cybersecurity"],
    ["Hugging Face dataset cards get an update", "rss-hf-blog", "AI"],
    ["Cloud spend optimization tools consolidate", "rss-cloudflare-blog", "Technology"],
  ] as const;
  let fill = articles.length;
  for (const [title, sourceId, category] of FILLER) {
    if (fill >= 50) break;
    fill += 1;
    const publishedAt = new Date(now.getTime() - (20 + rand() * 70) * 3_600_000);
    const a = makeArticle(title, `${category} brief item from the Pulse seed corpus.`, sourceId, publishedAt);
    if (a) articles.push(a);
  }

  // Score articles (relevance uses default interests).
  const interests: UserInterest[] = pulseConfig.interests.map((i) => ({ ...i }));
  for (const a of articles) {
    a.relevanceScore = computeRelevance({
      title: a.title,
      description: a.description,
      topics: a.topics,
      entities: a.entities,
      category: a.category,
      interests,
    });
    a.velocityScore = a.clusterId ? Math.round(clusterVelocity(articles.filter((x) => x.clusterId === a.clusterId), now)) : 0;
    a.importanceScore = computeImportance({
      sourceAuthority: a.sourceAuthority,
      sourceCount: a.clusterId ? 1 : 1,
      velocity: a.velocityScore,
      entityImportance: entityImportanceScore(a.entities),
      geoCount: a.country ? 1 : 0,
      hoursSinceUpdate: (now.getTime() - new Date(a.publishedAt).getTime()) / 3_600_000,
    });
  }

  // Cluster-level relevance + final hash.
  for (const c of clusters) {
    const cas = articles.filter((a) => a.clusterId === c.id);
    c.relevanceScore = Math.max(...cas.map((a) => a.relevanceScore), 0);
    c.sourceCount = normalizeSourceCount(c.sourceCount) > 0 ? c.sourceCount : c.sourceCount;
    c.clusterHash = clusterHash(cas.map((a) => a.id));
  }

  return { articles, clusters, interests };
}

/**
 * Initialize an empty repository with sources + interests + seed corpus.
 * Used by the memory demo mode and `npm run db:seed` for Postgres.
 */
export async function seedRepository(repo: Repository, options: { withArticles?: boolean } = {}): Promise<void> {
  const { withArticles = true } = options;
  for (const s of DEFAULT_SOURCES) await repo.saveSource(s);
  for (const i of pulseConfig.interests) await repo.setInterest(i.topic, i.weight);
  if (!withArticles) return;

  const { articles, clusters } = buildSeedData();
  for (const a of articles) {
    await repo.insertArticle(a);
    await repo.recordArticleTaxonomy(a.id, a.publishedAt, a.topics, a.entities);
    if (a.clusterId) await repo.linkArticleCluster(a.id, a.clusterId);
  }
  for (const c of clusters) await repo.upsertCluster(c);
}
