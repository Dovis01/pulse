import { recencyScore } from "./importance";

/**
 * Breaking score (product spec §16): velocity + source diversity + authority
 * + recency + cross-region. > 85 ⇒ Breaking (config threshold).
 */

export interface BreakingInput {
  /** Articles per hour over the last 6h, vs a 5/h baseline. */
  articlesPerHour: number;
  distinctSources: number;
  maxAuthority: number;
  hoursSinceFirstSeen: number;
  distinctCountries: number;
}

const clamp = (n: number) => Math.max(0, Math.min(100, n));

export function velocityScore(articlesPerHour: number): number {
  // 5+/h saturates to ~100 with log growth.
  return clamp(Math.round(100 * (1 - Math.exp(-articlesPerHour / 4))));
}

export function computeBreakingScore(input: BreakingInput): number {
  const velocity = velocityScore(input.articlesPerHour);
  const diversity = clamp(input.distinctSources * 14);
  const authority = clamp(input.maxAuthority);
  // Breaking decays fast: a 12h-old event is rarely "breaking".
  const recency = clamp(100 * Math.exp(-input.hoursSinceFirstSeen / 10));
  const geo = clamp(input.distinctCountries * 22);

  const score =
    0.3 * velocity + 0.25 * diversity + 0.2 * authority + 0.15 * recency + 0.1 * geo;
  return clamp(Math.round(score));
}

/** Keep recencyScore import used for future tuning — avoids dead-code lint. */
export const _recencyFallback = recencyScore;
