/**
 * Prompt registry (product spec §67). Prompts are versioned artifacts —
 * never inline them in business code. The used version is stamped onto
 * generated summaries for later regeneration (spec §66).
 */

export interface StorySummaryInput {
  canonicalTitle: string;
  articles: {
    title: string;
    source: string;
    publishedAt: string;
    description?: string;
  }[];
}

export const storySummaryV1 = {
  id: "story-summary",
  version: "v1",
  build(input: StorySummaryInput): string {
    const reports = input.articles
      .map((a, i) => `${i + 1}. [${a.source}] ${a.title}${a.description ? ` — ${a.description}` : ""}`)
      .join("\n");
    return `You are the intelligence analyst for Pulse, a personal global intelligence feed.

Below are multiple news reports describing the same underlying event.

EVENT: ${input.canonicalTitle}

REPORTS:
${reports}

Produce a structured synthesis of this event. Rules:
- Be factual; never invent facts that are not supported by the reports.
- Attribute uncertainty when reports disagree.
- summary_short: one neutral sentence (max 140 chars).
- summary_full: 2-4 paragraphs covering what happened, key details and notable context.
- why_it_matters: 1-2 sentences on significance for someone tracking AI, open source, markets and geopolitics.
- key_points: 3-5 short bullets.

Return JSON with keys: summary_short, summary_full, why_it_matters, key_points.`;
  },
};

export interface DailyBriefInput {
  date: string;
  stories: {
    title: string;
    category: string;
    summary: string;
    importance: number;
    sources: number;
  }[];
}

export const dailyBriefV1 = {
  id: "daily-brief",
  version: "v3",
  build(input: DailyBriefInput, lang: "en" | "zh" = "en"): string {
    const stories = input.stories
      .map(
        (s, i) =>
          `${i + 1}. [${s.category}] ${s.title}${s.summary && s.summary !== s.title ? ` — ${s.summary}` : ""} (${s.sources} source${s.sources === 1 ? "" : "s"}, importance ${s.importance})`,
      )
      .join("\n");
    const zhRules = `- intro:150-220 字编辑式导语,点明 2-3 条主线、它们之间的关联、今天特别值得关注的点。具体事实优先,不要空话。
- sections:把所有故事分为 5-7 个分区(如 全球、人工智能、科技、市场、开源、科学、安全)。每个分区文本必须详实:先对分区内每条新闻用 1-3 句中文概括其核心事实(关键数字、人物、机构、直接影响),再用 1 句总结该分区整体态势。禁止只罗列英文标题。
- watch:4-6 条值得关注的后续(即将发生的事件、预计发布、正在发酵的事态),每条附一句原因。
- 全部用简体中文自然表达,专有名词保留英文原名,数字保留。`;
    const enRules = `- intro: 150-220 words, editorial tone. Name the 2-3 dominant threads, how they connect, and what deserves particular attention today. Concrete facts over adjectives.
- sections: group ALL stories into 5-7 labeled sections (e.g. Global, AI, Technology, Markets, Open Source, Science, Security). Each section text must be substantive: 1-3 sentences per story covering its key facts (numbers, actors, direct impact), then 1 sentence on the section's overall picture. Never just list headlines.
- watch: 4-6 short items worth watching next (upcoming events, expected releases, developing situations), each with a reason.`;
    return `You are the editor of Pulse, a personal global intelligence feed.

Compose the ${input.date} daily brief from today's top stories:

${stories}

Rules:
${lang === "zh" ? zhRules : enRules}

Return JSON with keys: intro (string), sections (array of {label, text}), watch (array of strings). ${lang === "zh" ? "All values in Simplified Chinese; section labels also in Chinese." : "All values in English."}`;
  },
};

export interface ClassificationInput {
  title: string;
  description?: string;
  candidates: string[];
}

export const classificationV1 = {
  id: "classification",
  version: "v1",
  build(input: ClassificationInput): string {
    return `Classify this news item into exactly one category from: ${input.candidates.join(", ")}.

TITLE: ${input.title}
DESCRIPTION: ${input.description ?? "(none)"}

Also list up to 5 topic tags and up to 5 named entities.
Return JSON: { "category": string, "topics": string[], "entities": string[] }.`;
  },
};
