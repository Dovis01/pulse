import type {
  BriefSynthesis,
  AIProvider,
  ClassifyResult,
  ClusterSummaryResult,
} from "./types";
import type { ClassificationInput, DailyBriefInput, StorySummaryInput } from "@prompts";
import { classificationV1, dailyBriefV1, storySummaryV1 } from "@prompts";
import { AIRateLimitError } from "./types";

/**
 * Gemini provider (default hosted AI, cost spec §48/50). Structured JSON
 * output only — free-form parsing is forbidden (product spec §32).
 */

const DEFAULT_MODEL = "gemini-3.6-flash";

export class GeminiProvider implements AIProvider {
  readonly id = "gemini";
  readonly model: string;

  constructor(
    private apiKey: string,
    model?: string,
  ) {
    this.model = model?.trim() || DEFAULT_MODEL;
  }

  private async generateJson<T>(prompt: string, timeoutMs = 45_000): Promise<T> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      signal: AbortSignal.timeout(timeoutMs),
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.3,
          responseMimeType: "application/json",
        },
      }),
    });
    if (response.status === 429) {
      throw new AIRateLimitError("Gemini quota exhausted (429)");
    }
    if (response.status === 503) {
      // Free-tier overload is transient — tiered retries before giving up
      // (the next scheduled run retries again; no degrade cooldown).
      for (const delayMs of [2_500, 6_000]) {
        await new Promise((r) => setTimeout(r, delayMs));
        const retry = await fetch(url, {
          method: "POST",
          headers: { "content-type": "application/json" },
          signal: AbortSignal.timeout(timeoutMs),
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.3, responseMimeType: "application/json" },
          }),
        });
        if (retry.status === 429) throw new AIRateLimitError("Gemini quota exhausted (429)");
        if (retry.ok) {
          const data2 = (await retry.json()) as {
            candidates?: { content?: { parts?: { text?: string }[] } }[];
          };
          const text2 = data2.candidates?.[0]?.content?.parts?.[0]?.text;
          if (!text2) throw new Error("Gemini returned no content");
          return JSON.parse(text2) as T;
        }
      }
      throw new Error("Gemini overloaded after retries (503)");
    }
    if (!response.ok) {
      throw new Error(`Gemini HTTP ${response.status}`);
    }
    const data = (await response.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error("Gemini returned no content");
    return JSON.parse(text) as T;
  }

  async summarizeCluster(input: StorySummaryInput): Promise<ClusterSummaryResult> {
    const result = await this.generateJson<ClusterSummaryResult>(storySummaryV1.build(input));
    return {
      summary_short: String(result.summary_short ?? "").slice(0, 200),
      summary_full: String(result.summary_full ?? ""),
      why_it_matters: String(result.why_it_matters ?? ""),
      key_points: Array.isArray(result.key_points) ? result.key_points.slice(0, 5).map(String) : [],
    };
  }

  async synthesizeBrief(input: DailyBriefInput): Promise<BriefSynthesis> {
    // Two single-language calls beat one bilingual call: each finishes well
    // inside the serverless budget, and a failed language degrades alone.
    const build = (lang: "en" | "zh") => {
      const parse = (raw: Record<string, unknown>) => ({
        intro: typeof raw.intro === "string" ? raw.intro : "",
        sections: Array.isArray(raw.sections)
          ? raw.sections.slice(0, 8).map((s) => {
              const item = s as Record<string, unknown>;
              return { label: String(item.label ?? ""), text: String(item.text ?? "") };
            })
          : [],
        watch: Array.isArray(raw.watch) ? raw.watch.slice(0, 6).map(String) : [],
      });
      return this.generateJson<Record<string, unknown>>(dailyBriefV1.build(input, lang), 45_000).then(parse);
    };

    // Each language degrades alone — an overloaded response for one must
    // not discard the other.
    const [enSettled, zhSettled] = await Promise.allSettled([build("en"), build("zh")]);
    const empty = { intro: "", sections: [], watch: [] };
    const en = enSettled.status === "fulfilled" ? enSettled.value : empty;
    if (enSettled.status === "rejected") throw enSettled.reason;
    const zh = zhSettled.status === "fulfilled" ? zhSettled.value : empty;
    return {
      intro: en.intro,
      sections: en.sections,
      watch: en.watch,
      introZh: zh.intro || undefined,
      sectionsZh: zh.sections.length > 0 ? zh.sections : undefined,
      watchZh: zh.watch.length > 0 ? zh.watch : undefined,
    };
  }

  async classify(input: ClassificationInput): Promise<ClassifyResult> {
    const result = await this.generateJson<ClassifyResult>(classificationV1.build(input));
    return {
      category: String(result.category ?? "Other"),
      topics: Array.isArray(result.topics) ? result.topics.slice(0, 6).map(String) : [],
      entities: Array.isArray(result.entities) ? result.entities.slice(0, 6).map(String) : [],
    };
  }

  async translate(text: string, targetLang: "zh" | "en"): Promise<string> {
    const result = await this.generateJson<{ translation: string }>(
      `Translate the following text into ${targetLang === "zh" ? "Simplified Chinese" : "English"}. Preserve meaning and tone. Return JSON: { "translation": string }.\n\nTEXT: ${text}`,
    );
    return String(result.translation ?? text);
  }
}
