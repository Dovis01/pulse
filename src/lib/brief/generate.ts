import { pulseConfig } from "@config/pulse.config";
import { callAI } from "@/lib/ai";
import type { Repository } from "@/lib/db/repository";
import type { DailyBrief, StoryCluster } from "@/lib/news/types";
import { computeTrendSignals } from "@/lib/ranking/velocity";
import type { BriefSynthesis } from "@/lib/ai/types";
import { dailyBriefV1 } from "@prompts";
import { ResendProvider } from "@/lib/notifications/resend";

/**
 * Daily Brief generation (product spec §33, cost §114). Morning + evening.
 * AI synthesis when available; otherwise a deterministic editorial fallback
 * composed from cluster titles — the app never breaks without AI (§61/62).
 */

const SECTION_LABELS: Record<string, string> = {
  World: "Global",
  AI: "AI",
  Technology: "Technology",
  Markets: "Markets",
  OpenSource: "Open Source",
  Science: "Science",
  Business: "Business",
  Cybersecurity: "Security",
  Other: "More",
};

export function briefDateOf(now: Date, timezone: string = pulseConfig.timezone): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(now);
}

export function briefKindOf(now: Date, timezone: string = pulseConfig.timezone): DailyBrief["kind"] {
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", { timeZone: timezone, hour: "2-digit", hour12: false }).format(now),
  );
  return hour < 13 ? "morning" : "evening";
}

/** Deterministic fallback composition — aggregator mode (cost §62). */
export function composeRuleBasedBrief(clusters: StoryCluster[], watch: string[]): Omit<DailyBrief, "id" | "kind" | "briefDate" | "generatedAt" | "storyCount"> {
  const top = clusters.slice(0, 3).map((c) => c.canonicalTitle);
  const intro =
    top.length > 0
      ? `Today's signal is concentrated on ${top.length} developments: ${top
          .map((t) => `“${t}”`)
          .join("; ")}. Coverage below is ranked by importance across ${clusters.length} active stories from the last 24 hours.`
      : "No major stories in the last 24 hours. The feed stays quiet — check the Timeline for raw activity.";

  const byCategory = new Map<string, StoryCluster[]>();
  for (const cluster of clusters) {
    const label = SECTION_LABELS[cluster.category] ?? "More";
    const list = byCategory.get(label) ?? [];
    list.push(cluster);
    byCategory.set(label, list);
  }
  const sections = [...byCategory.entries()].map(([label, list]) => ({
    label,
    text: list
      .slice(0, 3)
      .map((c) => `${c.canonicalTitle} — ${c.sourceCount} source${c.sourceCount === 1 ? "" : "s"}, importance ${c.importanceScore}.`)
      .join(" "),
  }));

  return { intro, sections, watchList: watch };
}

export async function generateBrief(
  repo: Repository,
  now = new Date(),
): Promise<DailyBrief | null> {
  const kind = briefKindOf(now);
  const briefDate = briefDateOf(now);
  const since = new Date(now.getTime() - 24 * 3_600_000).toISOString();

  const clusters = await repo.listClusters({ since, orderBy: "importance", limit: 12 });
  const trending = computeTrendSignals(await repo.listArticles({ since, limit: 400 }), now);
  const watch = trending
    .slice(0, 5)
    .map((t) => `${t.label.replace(/\b\w/g, (c) => c.toUpperCase())} ↑${Math.max(0, t.changePct)}%`);

  let content: Omit<DailyBrief, "id" | "kind" | "briefDate" | "generatedAt" | "storyCount">;
  let model: string | undefined;
  let version: string = "rule-v1";

  if (clusters.length >= 3) {
    const synthesis = await callAI((provider) =>
      provider.synthesizeBrief({
        date: briefDate,
        stories: clusters.slice(0, 10).map((c) => ({
          title: c.canonicalTitle,
          category: SECTION_LABELS[c.category] ?? c.category,
          summary: c.summaryShort ?? c.canonicalTitle,
          importance: c.importanceScore,
        })),
      }),
    );
    if (synthesis) {
      const s: BriefSynthesis = synthesis.result;
      content = { intro: s.intro, sections: s.sections, watchList: s.watch.length > 0 ? s.watch : watch };
      model = synthesis.model;
      version = dailyBriefV1.version;
    } else {
      content = composeRuleBasedBrief(clusters, watch);
    }
  } else {
    content = composeRuleBasedBrief(clusters, watch);
  }

  const brief: DailyBrief = {
    id: crypto.randomUUID(),
    kind,
    briefDate,
    intro: content.intro,
    sections: content.sections,
    watchList: content.watchList,
    storyCount: clusters.length,
    model,
    version,
    generatedAt: now.toISOString(),
  };
  await repo.saveBrief(brief);
  return brief;
}

/** Send the digest email for a brief (Resend; optional, no-op if unset). */
export async function sendBriefDigest(brief: DailyBrief): Promise<boolean> {
  const resend = new ResendProvider();
  if (!resend.isConfigured()) return false;

  const sectionsHtml = brief.sections
    .map(
      (s) =>
        `<h3 style="font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#9B9B96;margin:28px 0 8px">${s.label}</h3><p style="margin:0 0 8px">${s.text}</p>`,
    )
    .join("");
  const watchHtml = brief.watchList.length
    ? `<h3 style="font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#9B9B96;margin:28px 0 8px">Watch today</h3><ul>${brief.watchList
        .map((w) => `<li>${w}</li>`)
        .join("")}</ul>`
    : "";

  const ok = await resend.send({
    subject: `Pulse Daily Brief — ${brief.briefDate} (${brief.kind})`,
    body: `<h2 style="font-weight:500;letter-spacing:-0.02em">The Daily Brief</h2><p>${brief.intro}</p>${sectionsHtml}${watchHtml}<p style="margin-top:32px;font-size:12px;color:#9B9B96">AI-generated summary based on ${brief.storyCount} clustered stories · <a href="${pulseConfig.site.url}/brief">Open in Pulse</a></p>`,
  });
  return ok;
}
