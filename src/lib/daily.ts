import { pulseConfig } from "@config/pulse.config";
import { generateBrief, sendBriefDigest } from "@/lib/brief/generate";
import { getRepository } from "@/lib/db";
import type { Repository } from "@/lib/db/repository";

/**
 * Daily cron duties (cost spec §72): Daily Brief, digest email, retention
 * cleanup, metrics. Everything best-effort and isolated.
 */

export interface DailyOutcome {
  briefGenerated: boolean;
  digestSent: boolean;
  prunedArticles: number;
  prunedRuns: number;
  prunedJobs: number;
}

export async function runDailyTasks(repo?: Repository): Promise<DailyOutcome> {
  const db = repo ?? (await getRepository());
  const outcome: DailyOutcome = {
    briefGenerated: false,
    digestSent: false,
    prunedArticles: 0,
    prunedRuns: 0,
    prunedJobs: 0,
  };

  // Retention first — it is cheap and must not be starved by a slow AI brief.
  try {
    const cleanup = await db.cleanup({
      rawContentDays: pulseConfig.retention.rawContentDays,
      articleDays: pulseConfig.retention.articleDays,
      runDays: pulseConfig.retention.runDays,
      jobDays: pulseConfig.retention.jobDays,
    });
    outcome.prunedArticles = cleanup.articlesPruned;
    outcome.prunedRuns = cleanup.runsPruned;
    outcome.prunedJobs = cleanup.jobsPruned;
  } catch {
    // ignore
  }

  try {
    const brief = await generateBrief(db);
    outcome.briefGenerated = Boolean(brief);
    if (brief) {
      outcome.digestSent = await sendBriefDigest(brief);
      if (outcome.digestSent) await db.recordUsage("email_sent", 1);
    }
  } catch {
    // brief failure is non-fatal
  }

  return outcome;
}
