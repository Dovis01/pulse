import { ENTITY_WEIGHTS } from "@/lib/news/classify";

/**
 * Importance score per product spec §17:
 *   importance = 0.25*sourceAuthority + 0.25*sourceCount + 0.20*velocity
 *              + 0.15*entityImportance + 0.10*geoSpread + 0.05*recency
 * All inputs normalized to 0–100; output clamped to 0–100.
 */

export interface ImportanceInput {
  /** Max source authority within the cluster (0–100). */
  sourceAuthority: number;
  /** Distinct sources covering the story. */
  sourceCount: number;
  /** Precomputed velocity 0–100. */
  velocity: number;
  /** Best entity importance (0 = unknown entities). */
  entityImportance: number;
  /** Distinct countries reporting. */
  geoCount: number;
  /** Hours since last update. */
  hoursSinceUpdate: number;
}

const clamp = (n: number) => Math.max(0, Math.min(100, n));

export function normalizeSourceCount(count: number): number {
  // 1 source ≈ 20, 5 ≈ 55, 10 ≈ 78, 20+ ≈ 100 (log saturation).
  if (count <= 1) return count === 1 ? 20 : 0;
  return clamp(Math.round(100 * (1 - Math.exp(-(count - 1) / 6))));
}

export function normalizeGeoSpread(count: number): number {
  return clamp(count * 25);
}

export function recencyScore(hoursSinceUpdate: number): number {
  return clamp(100 * Math.exp(-hoursSinceUpdate / 36));
}

export function entityImportanceScore(entities: string[]): number {
  let max = 0;
  for (const e of entities) {
    const w = ENTITY_WEIGHTS[e.toLowerCase()] ?? 0;
    if (w > max) max = w;
  }
  return max || (entities.length > 0 ? 35 : 15);
}

export function computeImportance(input: ImportanceInput): number {
  const sourceAuthority = clamp(input.sourceAuthority);
  const sourceCount = normalizeSourceCount(input.sourceCount);
  const velocity = clamp(input.velocity);
  const entityImportance = clamp(input.entityImportance);
  const geoSpread = normalizeGeoSpread(input.geoCount);
  const recency = recencyScore(input.hoursSinceUpdate);

  const score =
    0.25 * sourceAuthority +
    0.25 * sourceCount +
    0.2 * velocity +
    0.15 * entityImportance +
    0.1 * geoSpread +
    0.05 * recency;

  return clamp(Math.round(score));
}
