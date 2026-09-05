import { pulseConfig } from "@config/pulse.config";
import type { Repository } from "@/lib/db/repository";
import type { StoryCluster } from "@/lib/news/types";
import { ResendProvider } from "./resend";
import { TelegramProvider } from "./telegram";
import type { NotificationProvider } from "./types";

export const notificationProviders: NotificationProvider[] = [
  new TelegramProvider(),
  new ResendProvider(),
];

/** Current time in the app timezone as "HH:MM". */
export function localTimeNow(timezone: string = pulseConfig.timezone, now = new Date()): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(now);
}

export function inQuietHours(nowTime = localTimeNow()): { quiet: boolean; start: string; end: string } {
  const { start, end } = pulseConfig.notifications.quietHours;
  const toMinutes = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
  const cur = toMinutes(nowTime);
  const s = toMinutes(start);
  const e = toMinutes(end);
  // Window may wrap midnight (23:00 → 08:00).
  const quiet = s <= e ? cur >= s && cur < e : cur >= s || cur < e;
  return { quiet, start, end };
}

/**
 * Breaking alert pass (cost spec §85, §125): importance ≥ threshold, one
 * alert per cluster per day, max N per day, quiet hours respected.
 * Telegram first, then the web UI badge; email stays digest-only (§82).
 */
export async function processBreakingAlerts(repo: Repository, now = new Date()): Promise<number> {
  const { breakingMinImportance, maxAlertsPerDay } = pulseConfig.notifications;
  const { quiet } = inQuietHours();
  if (quiet) return 0;

  const sentToday = await repo.notificationsToday();
  let budget = maxAlertsPerDay - sentToday;
  if (budget <= 0) return 0;

  const since = new Date(now.getTime() - 24 * 3_600_000).toISOString();
  const candidates = await repo.listClusters({
    since,
    orderBy: "breaking",
    limit: 30,
  });

  const telegram = notificationProviders.find((p) => p.id === "telegram");
  let sent = 0;

  for (const cluster of candidates) {
    if (budget <= 0) break;
    if (!isAlertWorthy(cluster, breakingMinImportance)) continue;
    if (cluster.notifiedAt) continue;
    if (await repo.notificationSentFor(cluster.id, "telegram")) continue;
    if (!telegram?.isConfigured()) break;

    const sourcesWord = `${cluster.sourceCount} source${cluster.sourceCount === 1 ? "" : "s"}`;
    const ok = await telegram.send({
      subject: `⚡ BREAKING — ${cluster.canonicalTitle}`,
      body: [
        cluster.summaryShort ?? "",
        "",
        `${cluster.importanceScore} importance · ${sourcesWord}`,
        cluster.whyItMatters ? `\nWhy it matters: ${cluster.whyItMatters}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
      url: `${pulseConfig.site.url}/story/${cluster.slug || cluster.id}`,
    });
    await repo.recordNotification({
      channel: "telegram",
      clusterId: cluster.id,
      subject: cluster.canonicalTitle,
      status: ok ? "sent" : "failed",
      error: ok ? undefined : "telegram send failed",
    });
    if (ok) {
      cluster.notifiedAt = now.toISOString();
      await repo.upsertCluster(cluster);
      await repo.recordUsage("telegram_alert", 1);
      sent += 1;
      budget -= 1;
    }
  }
  return sent;
}

function isAlertWorthy(cluster: StoryCluster, minImportance: number): boolean {
  return cluster.isBreaking && cluster.importanceScore >= minImportance;
}
