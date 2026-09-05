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

const DEFAULT_MODEL = "gemini-2.0-flash";

export class GeminiProvider implements AIProvider {
  readonly id = "gemini";
  readonly model: string;

  constructor(
    private apiKey: string,
    model?: string,
  ) {
    this.model = model?.trim() || DEFAULT_MODEL;
  }

  private async generateJson<T>(prompt: string): Promise<T> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      signal: AbortSignal.timeout(30_000),
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.3,
          responseMimeType: "application/json",
        },
      }),
    });
    if (response.status === 429 || response.status === 503) {
      throw new AIRateLimitError(`Gemini quota exhausted (${response.status})`);
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
    const result = await this.generateJson<BriefSynthesis>(dailyBriefV1.build(input));
    return {
      intro: String(result.intro ?? ""),
      sections: Array.isArray(result.sections)
        ? result.sections.slice(0, 6).map((s) => ({ label: String(s.label ?? ""), text: String(s.text ?? "") }))
        : [],
      watch: Array.isArray(result.watch) ? result.watch.slice(0, 5).map(String) : [],
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
