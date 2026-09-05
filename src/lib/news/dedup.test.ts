import { describe, expect, it } from "vitest";
import { dedupe, type DedupLookup } from "./dedup";
import { canonicalizeUrl } from "./normalize";

function lookup(
  urls: string[],
  titles: { title: string; publishedAt: string; canonicalUrl?: string }[],
): DedupLookup {
  return {
    hasCanonicalUrl: (url) => urls.includes(url),
    recent: () =>
      titles.map((t) => ({
        canonicalUrl: t.canonicalUrl ?? "https://example.com/x",
        title: t.title,
        publishedAt: t.publishedAt,
      })),
  };
}

describe("dedupe", () => {
  const now = new Date("2026-09-04T12:00:00Z");

  it("flags exact canonical URL duplicates (level 1)", () => {
    const url = canonicalizeUrl("https://example.com/story?utm_source=x");
    const verdict = dedupe(
      { url, title: "Anything", publishedAt: now },
      lookup([url], []),
      { now },
    );
    expect(verdict).toEqual({ duplicate: true, level: "url" });
  });

  it("flags near-identical titles inside the window (level 2)", () => {
    const verdict = dedupe(
      {
        url: "https://other.com/nvidia-rubin",
        title: "NVIDIA launches Rubin Ultra AI platform",
        publishedAt: now,
      },
      lookup([], [
        {
          title: "Nvidia unveils Rubin Ultra AI platform",
          publishedAt: new Date(now.getTime() - 3_600_000).toISOString(),
        },
      ]),
      { tokenThreshold: 0.7, now },
    );
    expect(verdict.duplicate).toBe(true);
    if (verdict.duplicate) expect(verdict.level).toBe("title");
  });

  it("allows the same title outside the time window", () => {
    const verdict = dedupe(
      {
        url: "https://other.com/old",
        title: "NVIDIA launches Rubin Ultra AI platform",
        publishedAt: now,
      },
      lookup([], [
        {
          title: "NVIDIA launches Rubin Ultra AI platform",
          publishedAt: new Date(now.getTime() - 200 * 3_600_000).toISOString(),
        },
      ]),
      { timeWindowHours: 72, now },
    );
    expect(verdict).toEqual({ duplicate: false });
  });

  it("allows genuinely different stories", () => {
    const verdict = dedupe(
      { url: "https://other.com/fed", title: "Fed signals slower rate cuts", publishedAt: now },
      lookup([], [
        {
          title: "NVIDIA launches Rubin Ultra AI platform",
          publishedAt: new Date(now.getTime() - 3_600_000).toISOString(),
        },
      ]),
      { now },
    );
    expect(verdict).toEqual({ duplicate: false });
  });
});
