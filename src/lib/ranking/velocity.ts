import type { Article, StoryCluster } from "@/lib/news/types";
import { normalizeTitle } from "@/lib/news/normalize";

/**
 * Trending (product spec §35): current source coverage vs historical
 * baseline. Trending ≠ importance. Fully deterministic.
 */

export interface TrendSignal {
  label: string;
  kind: "entity" | "topic";
  current: number;
  baseline: number;
  changePct: number;
}

export function computeTrendSignals(
  articles: Article[],
  now: Date,
  windowHours = 24,
  baselineHours = 168,
): TrendSignal[] {
  const windowStart = now.getTime() - windowHours * 3_600_000;
  const baselineStart = now.getTime() - baselineHours * 3_600_000;
  // Scale baseline mentions (per baselineHours-windowHours) to the window size.
  const baselineScale = windowHours / Math.max(1, baselineHours - windowHours);

  interface Acc {
    current: number;
    baseline: number;
    kind: "entity" | "topic";
  }
  const acc = new Map<string, Acc>();

  const bump = (key: string, kind: "entity" | "topic", inWindow: boolean) => {
    let a = acc.get(key);
    if (!a) {
      a = { current: 0, baseline: 0, kind };
      acc.set(key, a);
    }
    if (inWindow) a.current += 1;
    else a.baseline += 1;
  };

  for (const article of articles) {
    const t = new Date(article.publishedAt).getTime();
    const inWindow = t >= windowStart;
    const inBaseline = t >= baselineStart && !inWindow;
    if (!inWindow && !inBaseline) continue;
    for (const e of article.entities) bump(e, "entity", inWindow);
    for (const tp of article.topics) bump(normalizeTitle(tp), "topic", inWindow);
  }

  const signals: TrendSignal[] = [];
  for (const [key, a] of acc) {
    if (a.current < 2) continue; // noise floor
    const baseline = a.baseline * baselineScale;
    const changePct = baseline <= 0.5 ? 100 : Math.round(((a.current - baseline) / baseline) * 100);
    signals.push({
      label: key,
      kind: a.kind,
      current: a.current,
      baseline: Math.round(baseline * 10) / 10,
      changePct,
    });
  }
  signals.sort((x, y) => y.changePct - x.changePct || y.current - x.current);
  return signals.slice(0, 12);
}

/** Cluster velocity helper: articles/hour in first 24h. */
export function clusterVelocity(articles: Article[], now: Date): number {
  const windowStart = now.getTime() - 24 * 3_600_000;
  const recent = articles.filter((a) => new Date(a.publishedAt).getTime() >= windowStart);
  if (recent.length === 0) return 0;
  const spanHours = Math.min(
    6,
    Math.max(
      0.5,
      recent.reduce((acc, a) => {
        const t = new Date(a.publishedAt).getTime();
        return Math.max(acc, (now.getTime() - t) / 3_600_000);
      }, 0),
    ),
  );
  return recent.length / spanHours;
}

export function isBreakingCluster(cluster: StoryCluster, threshold = 85): boolean {
  return cluster.breakingScore > threshold || (cluster.isBreaking && cluster.breakingScore >= threshold);
}
