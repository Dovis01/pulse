import type { RawArticle } from "./types";

/**
 * URL canonicalization — strips tracking params, fragments, normalizes host.
 * Deterministic; never uses AI (cost spec §55).
 */
export function canonicalizeUrl(input: string): string {
  let raw = input.trim();
  if (!raw) return raw;
  // Relative or protocol-less URLs become https URLs.
  if (!/^https?:\/\//i.test(raw)) raw = `https://${raw}`;

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return raw.toLowerCase();
  }

  url.hash = "";
  url.protocol = "https:";

  // Drop common AMP / proxy markers.
  if (/^www\./i.test(url.hostname)) url.hostname = url.hostname.slice(4);

  // Strip well-known tracking query params entirely; keep the rest sorted.
  const TRACKING =
    /^(utm_\w+|fbclid|gclid|igshid|mc_cid|mc_eid|ref_src|ref_url|cmp|ocid|at_\w+|ns_\w+|ito)$/i;
  const kept: [string, string][] = [];
  url.searchParams.forEach((value, key) => {
    if (!TRACKING.test(key)) kept.push([key, value]);
  });
  kept.sort((a, b) => a[0].localeCompare(b[0]));
  url.search = "";
  for (const [k, v] of kept) url.searchParams.append(k, v);

  // Collapse trailing slash on path (except root).
  if (url.pathname.length > 1 && url.pathname.endsWith("/")) {
    url.pathname = url.pathname.slice(0, -1);
  }

  return url.toString();
}

/** Normalize a title for similarity comparison. */
export function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u2018\u2019\u201c\u201d]/g, "'")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const STOP_TOKENS = new Set([
  "a","an","and","are","as","at","be","by","for","from","has","have","in","is",
  "it","its","of","on","or","that","the","to","was","were","will","with","after",
  "over","new","says","said","amid","into","up","out","about","how","why","what",
]);

/** Content tokens used for similarity. */
export function titleTokens(title: string): string[] {
  const tokens = normalizeTitle(title)
    .split(" ")
    .filter((t) => t.length > 1 && !STOP_TOKENS.has(t));
  return [...new Set(tokens)];
}

/** Jaccard similarity between two token sets. */
export function jaccard(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const setA = new Set(a);
  const setB = new Set(b);
  let inter = 0;
  for (const t of setA) if (setB.has(t)) inter += 1;
  return inter / (setA.size + setB.size - inter);
}

/** Rule-based language hint — no AI needed. */
export function detectLanguage(text: string, hint?: string): string {
  if (hint) return hint;
  const cjk = (text.match(/[\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af]/g) ?? []).length;
  const letters = (text.match(/\p{L}/gu) ?? []).length || 1;
  if (cjk / letters > 0.3) {
    const kana = (text.match(/[\u3040-\u30ff]/g) ?? []).length;
    const hangul = (text.match(/[\uac00-\ud7af]/g) ?? []).length;
    if (hangul > kana) return "ko";
    return kana > 0 ? "ja" : "zh";
  }
  return "en";
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
  hellip: "…", mdash: "—", ndash: "–", rsquo: "'", lsquo: "'", rdquo: '"', ldquo: '"',
};

/** Decode common HTML entities so feed text never leaks `&#039;` into the UI. */
export function decodeEntities(input: string): string {
  if (!input.includes("&")) return input;
  return input.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, code: string) => {
    const lower = code.toLowerCase();
    if (lower.startsWith("#x")) {
      const num = parseInt(code.slice(2), 16);
      return Number.isFinite(num) ? String.fromCodePoint(num) : match;
    }
    if (lower.startsWith("#")) {
      const num = parseInt(code.slice(1), 10);
      return Number.isFinite(num) ? String.fromCodePoint(num) : match;
    }
    return NAMED_ENTITIES[lower] ?? match;
  });
}

/** Truncate long bodies — Pulse stores excerpts, not archives (cost §40). */
export function truncate(text: string | undefined, max = 600): string | undefined {
  if (!text) return undefined;
  const clean = decodeEntities(text.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean || undefined;
  return `${clean.slice(0, max - 1).trimEnd()}…`;
}

export function slugify(text: string, suffix: string): string {
  const base = normalizeTitle(text)
    .split(" ")
    .slice(0, 8)
    .join("-")
    .replace(/[^a-z0-9-]/g, "");
  const tail = suffix.slice(0, 8);
  return `${base || "story"}-${tail}`.replace(/-+$/, "") || "story";
}

/** Stable hash (FNV-1a 32-bit, hex) — sufficient for cluster fingerprints. */
export function fnv1a(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

export function hoursBetween(a: Date, b: Date): number {
  return Math.abs(a.getTime() - b.getTime()) / 3_600_000;
}

/** Build the stored article shape from a raw item (classification added later). */
export function articleIdentity(raw: RawArticle): {
  canonicalUrl: string;
  normalizedTokens: string[];
  titleKey: string;
} {
  const canonicalUrl = canonicalizeUrl(raw.url);
  const tokens = titleTokens(raw.title);
  return {
    canonicalUrl,
    normalizedTokens: tokens,
    titleKey: normalizeTitle(raw.title),
  };
}
