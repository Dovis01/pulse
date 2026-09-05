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

const SECTION_LABELS_ZH: Record<string, string> = {
  World: "全球",
  AI: "人工智能",
  Technology: "科技",
  Markets: "市场",
  OpenSource: "开源",
  Science: "科学",
  Business: "商业",
  Cybersecurity: "安全",
  Other: "更多",
};

export interface BriefContent {
  intro: string;
  sections: { label: string; text: string }[];
  watchList: string[];
  introZh?: string;
  sectionsZh?: { label: string; text: string }[];
  watchZh?: string[];
}

/** Deterministic bilingual fallback — aggregator mode (cost §62), richer sections. */
export function composeRuleBasedBrief(clusters: StoryCluster[], watch: string[]): BriefContent {
  const top = clusters.slice(0, 3).map((c) => c.canonicalTitle);
  const intro =
    top.length > 0
      ? `Today's signal is concentrated on ${top.length} developments: ${top
          .map((t) => `“${t}”`)
          .join("; ")}. Coverage below is ranked by importance across ${clusters.length} active stories from the last 24 hours, with the busiest threads drawn from ${clusters.reduce((acc, c) => acc + c.sourceCount, 0)} source reports.`
      : "No major stories in the last 24 hours. The feed stays quiet — check the Timeline for raw activity.";
  const introZh =
    top.length > 0
      ? `今日信号集中在 ${top.length} 项进展:${top.map((t) => `“${t}”`).join(";")}。以下内容按重要度排列近 24 小时的 ${clusters.length} 条活跃报道,汇总自 ${clusters.reduce((acc, c) => acc + c.sourceCount, 0)} 篇来源报道。`
      : "过去 24 小时没有重大新闻。信息流保持安静——可查看 Timeline 了解原始动态。";

  const byCategory = new Map<string, StoryCluster[]>();
  for (const cluster of clusters) {
    const label = SECTION_LABELS[cluster.category] ?? "More";
    const list = byCategory.get(label) ?? [];
    list.push(cluster);
    byCategory.set(label, list);
  }

  const sections: { label: string; text: string }[] = [];
  const sectionsZh: { label: string; text: string }[] = [];
  for (const [label, list] of byCategory) {
    const total = list.reduce((acc, c) => acc + c.sourceCount, 0);
    // 3-5 substantive bullets per section: headline + sources + summary line.
    const bullets = list.slice(0, 5).map((c) => {
      const detail = (c.summaryFull ?? c.summaryShort ?? "").replace(/\s+/g, " ").trim();
      const detailZh = detail ? `\n  ${detail.slice(0, 400)}` : "";
      return `• ${c.canonicalTitle} (${c.sourceCount} source${c.sourceCount === 1 ? "" : "s"}, importance ${c.importanceScore})${detailZh}`;
    });
    sections.push({ label, text: bullets.join("\n") });
    const labelZh = SECTION_LABELS_ZH[list[0]?.category ?? "Other"] ?? "更多";
    sectionsZh.push({
      label: labelZh,
      text: `本分区共 ${list.length} 条相关报道、来自 ${total} 个来源。\n${bullets.join("\n")}`,
    });
  }

  return {
    intro,
    sections,
    watchList: watch,
    introZh,
    sectionsZh: sectionsZh.length > 0 ? sectionsZh : undefined,
    watchZh: watch.length > 0 ? watch.map((w) => w) : undefined,
  };
}

export function briefDateOf(now: Date, timezone: string = pulseConfig.timezone): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(now);
}

export function briefKindOf(now: Date, timezone: string = pulseConfig.timezone): DailyBrief["kind"] {
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", { timeZone: timezone, hour: "2-digit", hour12: false }).format(now),
  );
  return hour < 13 ? "morning" : "evening";
}


export async function generateBrief(
  repo: Repository,
  now = new Date(),
): Promise<DailyBrief | null> {
  const kind = briefKindOf(now);
  const briefDate = briefDateOf(now);
  const since = new Date(now.getTime() - 24 * 3_600_000).toISOString();

  const clusters = await repo.listClusters({ since, orderBy: "importance", limit: 24 });
  const trending = computeTrendSignals(await repo.listArticles({ since, limit: 400 }), now);
  const watch = trending
    .slice(0, 6)
    .map((t) => `${t.label.replace(/\b\w/g, (c) => c.toUpperCase())} ↑${Math.max(0, t.changePct)}%`);

  let content: BriefContent = composeRuleBasedBrief(clusters, watch);
  let model: string | undefined;
  let version: string = "rule-v2";

  if (clusters.length >= 3) {
    const synthesis = await callAI((provider) =>
      provider.synthesizeBrief({
        date: briefDate,
        stories: clusters.slice(0, 18).map((c) => ({
          title: c.canonicalTitle,
          category: SECTION_LABELS[c.category] ?? c.category,
          summary: c.summaryShort ?? c.canonicalTitle,
          importance: c.importanceScore,
          sources: c.sourceCount,
        })),
      }),
    );
    if (synthesis) {
      const s: BriefSynthesis = synthesis.result;
      content = {
        intro: s.intro,
        sections: s.sections,
        watchList: s.watch.length > 0 ? s.watch : watch,
        introZh: s.introZh,
        sectionsZh: s.sectionsZh,
        watchZh: s.watchZh,
      };
      model = synthesis.model;
      version = dailyBriefV1.version;
    }
  }

  // Guarantee a Chinese edition even if the provider omitted it.
  if (!content.introZh) {
    const fallback = composeRuleBasedBrief(clusters, watch);
    content = { ...content, introZh: fallback.introZh, sectionsZh: content.sectionsZh ?? fallback.sectionsZh, watchZh: content.watchZh ?? fallback.watchZh };
  }

  const brief: DailyBrief = {
    id: crypto.randomUUID(),
    kind,
    briefDate,
    intro: content.intro,
    sections: content.sections,
    watchList: content.watchList,
    introZh: content.introZh,
    sectionsZh: content.sectionsZh,
    watchZh: content.watchZh,
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

  const html = (lang: "en" | "zh"): string => {
    const intro = lang === "en" ? brief.intro : brief.introZh ?? brief.intro;
    const sections = lang === "en" ? brief.sections : brief.sectionsZh ?? brief.sections;
    const watch = lang === "en" ? brief.watchList : brief.watchZh ?? brief.watchList;
    const heading = lang === "en" ? "The Daily Brief" : "每日简报";
    const watchHeading = lang === "en" ? "Watch today" : "今日关注";
    const footerSource =
      lang === "en"
        ? `AI-generated summary based on ${brief.storyCount} clustered stories`
        : `基于 ${brief.storyCount} 条聚类报道的 AI 摘要`;
    const footerOpen = lang === "en" ? "Open in Pulse" : "打开 Pulse";
    return `
      <h2 style="font-weight:500;letter-spacing:-0.02em;margin:0 0 12px">${heading}</h2>
      <p style="margin:0 0 8px">${intro}</p>
      ${sections
        .map(
          (section) => `
        <h3 style="font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#9B9B96;margin:24px 0 8px">${section.label}</h3>
        <div style="white-space:pre-line;margin:0 0 8px;line-height:1.7">${section.text}</div>`,
        )
        .join("")}
      ${
        watch.length
          ? `<h3 style="font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#9B9B96;margin:24px 0 8px">${watchHeading}</h3><ul style="margin:0;padding-left:20px;line-height:1.8">${watch
              .map((w) => `<li>${w}</li>`)
              .join("")}</ul>`
          : ""
      }
      <p style="margin-top:28px;font-size:12px;color:#9B9B96">${footerSource} · <a href="${pulseConfig.site.url}/brief">${footerOpen} →</a></p>
    `;
  };

  const divider = `<hr style="border:none;border-top:1px solid #E8E8E4;margin:32px 0" />`;

  const ok = await resend.send({
    subject: `Pulse 每日简报 Daily Brief — ${brief.briefDate} (${brief.kind === "morning" ? "晨报" : "晚报"})`,
    body: `<div style="font-family:Georgia,serif;max-width:600px;margin:0 auto;line-height:1.6;color:#181817;color-scheme:light dark">${html("zh")}${divider}${html("en")}</div>`,
  });
  return ok;
}
