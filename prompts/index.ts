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
  stories: { title: string; category: string; summary: string; importance: number }[];
}

export const dailyBriefV1 = {
  id: "daily-brief",
  version: "v1",
  build(input: DailyBriefInput): string {
    const stories = input.stories
      .map((s, i) => `${i + 1}. [${s.category}] ${s.title} — ${s.summary} (importance ${s.importance})`)
      .join("\n");
    return `You are the editor of Pulse, a personal global intelligence feed.

Compose the ${input.date} daily brief from today's top stories:

${stories}

Rules:
- intro: 120-200 words, editorial tone, naming the 2-3 dominant threads and what deserves attention. No fluff, no greeting.
- sections: group the stories into 3-5 labeled sections (e.g. Global, AI, Technology, Markets, Open Source). Each section: 1-3 sentences synthesizing its stories.
- watch: 3-5 short items worth watching next (developments, events, releases).

Return JSON with keys: intro, sections (array of {label, text}), watch (array of strings).`;
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
