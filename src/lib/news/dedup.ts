import { jaccard, titleTokens } from "./normalize";

/**
 * Non-AI deduplication (cost spec §43, product spec §29 L1/L2).
 * L1 = canonical URL exact match; L2 = normalized title token similarity
 * inside a time window. Embedding-based L3 is deliberately NOT used in MVP.
 */

export interface DedupCandidate {
  canonicalUrl: string;
  title: string;
  publishedAt: string;
}

export interface DedupLookup {
  hasCanonicalUrl(url: string): boolean;
  /** Recent candidate titles within the dedup window (caller limits scope). */
  recent(): DedupCandidate[];
}

export interface DedupOptions {
  tokenThreshold?: number;
  timeWindowHours?: number;
  now?: Date;
}

export type DedupVerdict =
  | { duplicate: false }
  | { duplicate: true; level: "url" | "title"; matchedUrl?: string };

export function dedupe(
  incoming: { url: string; title: string; publishedAt: Date },
  lookup: DedupLookup,
  options: DedupOptions = {},
): DedupVerdict {
  const tokenThreshold = options.tokenThreshold ?? 0.8;
  const windowHours = options.timeWindowHours ?? 72;
  const now = options.now ?? new Date();

  // Level 1 — canonical URL.
  // (Caller canonicalizes; lookup compares canonical forms.)
  if (lookup.hasCanonicalUrl(incoming.url)) {
    return { duplicate: true, level: "url" };
  }

  // Level 2 — title similarity inside the time window.
  const incomingTokens = titleTokens(incoming.title);
  const incomingTime = incoming.publishedAt.getTime() || now.getTime();
  for (const candidate of lookup.recent()) {
    const candidateTime = new Date(candidate.publishedAt).getTime();
    const hours = Math.abs(incomingTime - candidateTime) / 3_600_000;
    if (hours > windowHours) continue;
    const score = jaccard(incomingTokens, titleTokens(candidate.title));
    if (score >= tokenThreshold) {
      return { duplicate: true, level: "title", matchedUrl: candidate.canonicalUrl };
    }
  }

  return { duplicate: false };
}
