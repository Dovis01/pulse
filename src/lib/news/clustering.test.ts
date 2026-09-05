import { describe, expect, it } from "vitest";
import { classifyRules, extractEntities } from "./classify";
import { shouldJoinCluster, clusterHash, mergeClusterMeta, type ClusterSeed } from "./clustering";
import { computeImportance } from "@/lib/ranking/importance";
import { computeBreakingScore } from "@/lib/ranking/breaking";
import { computeRelevance, computeForYouScore } from "@/lib/ranking/relevance";

describe("rule classification", () => {
  it("classifies AI items from keywords", () => {
    const result = classifyRules(
      "OpenAI releases new LLM with better inference performance",
    );
    expect(result.category).toBe("AI");
    expect(result.confidence).toBeGreaterThan(0.4);
  });

  it("classifies cybersecurity items", () => {
    const result = classifyRules("Ransomware attack breaches logistics firm, data leaked");
    expect(result.category).toBe("Cybersecurity");
  });

  it("falls back to the source category hint", () => {
    const result = classifyRules("Quarterly update on operations", "Markets");
    expect(result.category).toBe("Markets");
  });

  it("extracts weighted entities", () => {
    const { entities, importance } = extractEntities("NVIDIA and OpenAI announce partnership");
    expect(entities).toContain("nvidia");
    expect(entities).toContain("openai");
    expect(importance).toBeGreaterThanOrEqual(95);
  });

  it("does not substring-match entities (euro ≠ eu, feed ≠ fed)", () => {
    const { entities } = extractEntities("Euro zone inflation feeds concerns about Europe");
    expect(entities).not.toContain("eu");
    expect(entities).not.toContain("fed");
  });

  it("does not classify 'load-aware scheduling' as World via 'war'", () => {
    const result = classifyRules("vLLM merged PR: load-aware scheduling for inference");
    expect(result.category).not.toBe("World");
  });

  it("decodes HTML entities before matching", () => {
    const { entities } = extractEntities("NVIDIA&#039;s Rubin platform &amp; partners");
    expect(entities).toContain("nvidia");
  });
});

const seed = (over: Partial<ClusterSeed> = {}): ClusterSeed => ({
  id: "c1",
  canonicalTitle: "NVIDIA announces Rubin Ultra AI platform",
  category: "AI",
  entities: ["nvidia"],
  topics: ["AI"],
  countries: [],
  sourceNames: [],
  createdAt: new Date("2026-09-04T10:00:00Z"),
  updatedAt: new Date("2026-09-04T11:00:00Z"),
  tokenSample: ["nvidia", "announces", "rubin", "ultra", "ai", "platform"],
  ...over,
});

describe("clustering", () => {
  const at = (iso: string) => new Date(iso);

  it("joins high-similarity coverage of the same event", () => {
    const result = shouldJoinCluster(
      ["nvidia", "unveils", "rubin", "ultra", "ai", "platform"],
      ["nvidia"],
      at("2026-09-04T11:30:00Z"),
      seed(),
    );
    expect(result.matchedClusterId).toBe("c1");
    expect(result.similarity).toBeGreaterThan(0.3);
  });

  it("rejects coverage outside the time window", () => {
    const result = shouldJoinCluster(
      ["nvidia", "announces", "rubin", "ultra", "ai", "platform"],
      ["nvidia"],
      at("2026-09-10T11:00:00Z"),
      seed(),
    );
    expect(result.matchedClusterId).toBeNull();
  });

  it("rejects unrelated stories even inside the window", () => {
    const result = shouldJoinCluster(
      ["fed", "signals", "slower", "rate", "cuts"],
      [],
      at("2026-09-04T11:30:00Z"),
      seed(),
    );
    expect(result.matchedClusterId).toBeNull();
  });

  it("produces identical hashes for identical membership", () => {
    expect(clusterHash(["a", "b"])).toBe(clusterHash(["b", "a"]));
    expect(clusterHash(["a", "b"])).not.toBe(clusterHash(["a", "c"]));
  });

  it("merges metadata across variants", () => {
    const meta = mergeClusterMeta([
      {
        entities: ["nvidia"],
        topics: ["AI"],
        country: "US",
        category: "AI",
      },
      {
        entities: ["tsmc"],
        topics: ["Semiconductors"],
        country: "TW",
        category: "Technology",
      },
    ] as never[]);
    expect(meta.entities).toEqual(expect.arrayContaining(["nvidia", "tsmc"]));
    expect(meta.countries).toEqual(expect.arrayContaining(["US", "TW"]));
    expect(meta.category).toBe("AI");
  });
});

describe("importance score (spec §17 weights)", () => {
  it("ranks multi-source authoritative coverage highest", () => {
    const big = computeImportance({
      sourceAuthority: 95,
      sourceCount: 21,
      velocity: 90,
      entityImportance: 95,
      geoCount: 4,
      hoursSinceUpdate: 1,
    });
    const small = computeImportance({
      sourceAuthority: 40,
      sourceCount: 1,
      velocity: 5,
      entityImportance: 15,
      geoCount: 0,
      hoursSinceUpdate: 30,
    });
    expect(big).toBeGreaterThan(80);
    expect(small).toBeLessThan(30);
    expect(big).toBeLessThanOrEqual(100);
  });

  it("decays recency", () => {
    const fresh = computeImportance({
      sourceAuthority: 80, sourceCount: 5, velocity: 50, entityImportance: 60, geoCount: 1, hoursSinceUpdate: 0,
    });
    const stale = computeImportance({
      sourceAuthority: 80, sourceCount: 5, velocity: 50, entityImportance: 60, geoCount: 1, hoursSinceUpdate: 72,
    });
    expect(fresh).toBeGreaterThan(stale);
  });
});

describe("breaking score (spec §16)", () => {
  it("crosses the threshold for fast, wide, fresh events", () => {
    const score = computeBreakingScore({
      articlesPerHour: 12,
      distinctSources: 15,
      maxAuthority: 92,
      hoursSinceFirstSeen: 1,
      distinctCountries: 4,
    });
    expect(score).toBeGreaterThan(85);
  });

  it("stays low for single-source slow coverage", () => {
    const score = computeBreakingScore({
      articlesPerHour: 0.5,
      distinctSources: 1,
      maxAuthority: 60,
      hoursSinceFirstSeen: 20,
      distinctCountries: 0,
    });
    expect(score).toBeLessThan(50);
  });
});

describe("relevance + for-you", () => {
  const interests = [
    { topic: "Artificial Intelligence", weight: 1 },
    { topic: "Markets", weight: 0.5 },
    { topic: "Sports", weight: 0.1 },
  ];

  it("scores AI stories above market stories for an AI-heavy profile", () => {
    const ai = computeRelevance({
      title: "OpenAI releases new reasoning model",
      topics: ["Artificial Intelligence", "LLM"],
      entities: ["openai"],
      category: "AI",
      interests,
    });
    const market = computeRelevance({
      title: "Fed holds rates steady",
      topics: ["Markets"],
      entities: [],
      category: "Markets",
      interests,
    });
    expect(ai).toBeGreaterThan(market);
  });

  it("blends importance and relevance 55/45", () => {
    expect(computeForYouScore(80, 60)).toBe(71);
  });
});
