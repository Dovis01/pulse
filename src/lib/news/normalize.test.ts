import { describe, expect, it } from "vitest";
import {
  canonicalizeUrl,
  detectLanguage,
  fnv1a,
  jaccard,
  normalizeTitle,
  slugify,
  titleTokens,
  truncate,
} from "./normalize";

describe("canonicalizeUrl", () => {
  it("strips tracking params", () => {
    const input =
      "https://www.example.com/news/story?utm_source=x&fbclid=abc&id=7";
    expect(canonicalizeUrl(input)).toBe("https://example.com/news/story?id=7");
  });

  it("removes fragments and trailing slashes", () => {
    expect(canonicalizeUrl("https://example.com/news/story/#top")).toBe(
      "https://example.com/news/story",
    );
    expect(canonicalizeUrl("https://example.com/news/")).toBe("https://example.com/news");
  });

  it("normalizes protocol and www", () => {
    expect(canonicalizeUrl("http://www.EXAMPLE.com/a")).toBe("https://example.com/a");
  });

  it("sorts remaining query params", () => {
    expect(canonicalizeUrl("https://example.com/a?b=2&a=1")).toBe("https://example.com/a?a=1&b=2");
  });

  it("handles bare hosts", () => {
    expect(canonicalizeUrl("example.com/x")).toBe("https://example.com/x");
  });
});

describe("normalizeTitle / tokens / jaccard", () => {
  it("normalizes case and punctuation", () => {
    expect(normalizeTitle("NVIDIA Announces: “Rubin Ultra” Platform!")).toBe(
      "nvidia announces rubin ultra platform",
    );
  });

  it("drops stop tokens", () => {
    expect(titleTokens("The new NVIDIA chips are here")).toEqual(["nvidia", "chips", "here"]);
  });

  it("scores similar titles high and different titles low", () => {
    const a = titleTokens("NVIDIA launches Rubin Ultra AI platform");
    const b = titleTokens("Nvidia unveils Rubin Ultra platform for AI");
    const c = titleTokens("Fed signals slower pace of rate cuts");
    expect(jaccard(a, b)).toBeGreaterThan(0.5);
    expect(jaccard(a, c)).toBeLessThan(0.15);
  });
});

describe("detectLanguage", () => {
  it("uses the hint when provided", () => {
    expect(detectLanguage("anything", "de")).toBe("de");
  });
  it("detects CJK languages", () => {
    expect(detectLanguage("日本のニュースです")).toBe("ja");
    expect(detectLanguage("这是一条中文新闻")).toBe("zh");
  });
  it("defaults to english", () => {
    expect(detectLanguage("Plain english text")).toBe("en");
  });
});

describe("misc", () => {
  it("truncates with ellipsis and strips tags", () => {
    const out = truncate("<p>" + "x".repeat(700) + "</p>", 100);
    expect(out).toBeDefined();
    expect(out!.length).toBeLessThanOrEqual(100);
    expect(out!.endsWith("…")).toBe(true);
  });
  it("builds stable slugs", () => {
    expect(slugify("NVIDIA Rubin Ultra Launch", "abcd1234")).toMatch(/^nvidia-rubin-ultra-launch-abcd1234$/);
  });
  it("hashes deterministically", () => {
    expect(fnv1a("a|b|c")).toBe(fnv1a("a|b|c"));
    expect(fnv1a("a|b|c")).not.toBe(fnv1a("c|b|a"));
  });
});
