import { pulseConfig } from "@config/pulse.config";
import { getAIGate } from "@/lib/ai";
import { getRepository } from "@/lib/db";
import { notificationProviders } from "@/lib/notifications/alerts";
import type { SystemStatus } from "@/lib/news/types";

/** Settings → System (product spec §68) + provider health (cost §97). */
export async function getSystemStatus(): Promise<SystemStatus> {
  const repo = await getRepository();
  const runs = await repo.recentRuns(30);
  const lastRun = runs[0];
  const lastSuccessful = runs.find((r) => r.created > 0 && r.finishedAt);
  const articleCount = await repo.countArticles();
  const clusterCount = await repo.countClusters();
  const brief = await repo.latestBrief();

  const providerLastRun = new Map<string, (typeof runs)[number]>();
  for (const run of runs) {
    if (!providerLastRun.has(run.provider)) providerLastRun.set(run.provider, run);
  }
  let sourcesHealthy = 0;
  let sourcesFailing = 0;
  for (const [, run] of providerLastRun) {
    if (run.error || (run.finishedAt && run.failed > 0 && run.created === 0)) sourcesFailing += 1;
    else sourcesHealthy += 1;
  }

  const aiGate = await getAIGate();
  const telegram = notificationProviders.find((p) => p.id === "telegram");
  const email = notificationProviders.find((p) => p.id === "email");

  return {
    database: repo.kind,
    ai: {
      configured: Boolean(aiGate.provider),
      provider: pulseConfig.ai.provider,
      model: aiGate.provider?.model ?? "(not configured)",
      degraded: aiGate.degraded || (!aiGate.provider && pulseConfig.ai.enabled),
    },
    telegram: Boolean(telegram?.isConfigured()),
    email: Boolean(email?.isConfigured()),
    lastCronAt: lastRun?.startedAt,
    lastSuccessfulFetchAt: lastSuccessful?.finishedAt ?? lastSuccessful?.startedAt,
    sourcesHealthy,
    sourcesFailing,
    articleCount,
    clusterCount,
    lastBriefAt: brief?.generatedAt,
  };
}
