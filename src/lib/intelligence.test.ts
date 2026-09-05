import { describe, expect, it } from "vitest";
import { composeRuleBasedBrief, briefDateOf, briefKindOf } from "@/lib/brief/generate";
import { inQuietHours, localTimeNow } from "@/lib/notifications/alerts";
import type { StoryCluster } from "@/lib/news/types";
import { computeTrendSignals } from "@/lib/ranking/velocity";
import type { Article } from "@/lib/news/types";

const cluster = (over: Partial<StoryCluster>): StoryCluster => ({
  id: "c",
  canonicalTitle: "Test story",
  slug: "test-story",
  category: "AI",
  topics: [],
  entities: [],
  countries: [],
  importanceScore: 50,
  breakingScore: 0,
  velocityScore: 0,
  relevanceScore: 0,
  sourceCount: 3,
  firstSeenAt: new Date().toISOString(),
  lastUpdatedAt: new Date().toISOString(),
  isBreaking: false,
  ...over,
});

describe("daily brief fallback", () => {
  it("composes an editorial brief without AI", () => {
    const brief = composeRuleBasedBrief(
      [
        cluster({ canonicalTitle: "NVIDIA announces Rubin", category: "AI", importanceScore: 90 }),
        cluster({ canonicalTitle: "Fed holds rates", category: "Markets" }),
      ],
      ["NVIDIA ↑42%"],
    );
    expect(brief.intro).toContain("NVIDIA");
    expect(brief.sections.map((s) => s.label)).toContain("AI");
    expect(brief.watchList).toContain("NVIDIA ↑42%");
  });

  it("handles an empty day", () => {
    const brief = composeRuleBasedBrief([], []);
    expect(brief.intro).toContain("No major stories");
  });
});

describe("brief date/kind", () => {
  it("maps hours to morning/evening", () => {
    const morning = new Date("2026-09-04T03:00:00Z"); // 12:00 JST boundary check uses <13
    expect(["morning", "evening"]).toContain(briefKindOf(morning));
    expect(briefDateOf(morning)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("quiet hours", () => {
  it("detects the overnight window", () => {
    expect(inQuietHours("23:30").quiet).toBe(true);
    expect(inQuietHours("02:00").quiet).toBe(true);
    expect(inQuietHours("12:00").quiet).toBe(false);
    expect(inQuietHours("08:00").quiet).toBe(false);
  });

  it("formats the local time", () => {
    expect(localTimeNow("UTC", new Date("2026-09-04T10:30:00Z"))).toBe("10:30");
  });
});

describe("trending signals", () => {
  it("surges entities with recent multi-mention coverage", () => {
    const now = new Date("2026-09-04T12:00:00Z");
    const article = (title: string, entities: string[], hoursAgo: number): Article => ({
      id: title,
      sourceId: "s",
      sourceName: "S",
      sourceAuthority: 80,
      sourceProvider: "rss",
      url: `https://example.com/${title}`,
      canonicalUrl: `https://example.com/${title}`,
      title,
      category: "AI",
      topics: [],
      entities,
      tags: [],
      publishedAt: new Date(now.getTime() - hoursAgo * 3_600_000).toISOString(),
      fetchedAt: now.toISOString(),
      importanceScore: 0,
      relevanceScore: 0,
      velocityScore: 0,
    });
    const articles = [
      article("a", ["nvidia"], 1),
      article("b", ["nvidia"], 2),
      article("c", ["nvidia"], 3),
      article("d", ["nvidia"], 100), // baseline
    ];
    const signals = computeTrendSignals(articles, now);
    const nvidia = signals.find((s) => s.label === "nvidia");
    expect(nvidia).toBeDefined();
    expect(nvidia!.changePct).toBeGreaterThan(0);
  });
});
