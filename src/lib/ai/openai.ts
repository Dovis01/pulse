import type {
  AIProvider,
  BriefSynthesis,
  ClassifyResult,
  ClusterSummaryResult,
} from "./types";
import type { ClassificationInput, DailyBriefInput, StorySummaryInput } from "@prompts";
import { classificationV1, dailyBriefV1, storySummaryV1 } from "@prompts";
import { AIRateLimitError } from "./types";

/**
 * OpenAI-compatible provider (optional; requires ALLOW_PAID_AI=true because
 * OpenAI has no free tier — cost spec §103).
 */

const DEFAULT_MODEL = "gpt-4o-mini";

export class OpenAIProvider implements AIProvider {
  readonly id = "openai";
  readonly model: string;

  constructor(
    private apiKey: string,
    model?: string,
  ) {
    this.model = model?.trim() || DEFAULT_MODEL;
  }

  private async generateJson<T>(prompt: string): Promise<T> {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${this.apiKey}`,
      },
      signal: AbortSignal.timeout(30_000),
      body: JSON.stringify({
        model: this.model,
        temperature: 0.3,
        response_format: { type: "json_object" },
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (response.status === 429) throw new AIRateLimitError("OpenAI quota exhausted");
    if (!response.ok) throw new Error(`OpenAI HTTP ${response.status}`);
    const data = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const text = data.choices?.[0]?.message?.content;
    if (!text) throw new Error("OpenAI returned no content");
    return JSON.parse(text) as T;
  }

  async summarizeCluster(input: StorySummaryInput): Promise<ClusterSummaryResult> {
    return this.generateJson<ClusterSummaryResult>(storySummaryV1.build(input));
  }

  async synthesizeBrief(input: DailyBriefInput): Promise<BriefSynthesis> {
    return this.generateJson<BriefSynthesis>(dailyBriefV1.build(input));
  }

  async classify(input: ClassificationInput): Promise<ClassifyResult> {
    return this.generateJson<ClassifyResult>(classificationV1.build(input));
  }

  async translate(text: string, targetLang: "zh" | "en"): Promise<string> {
    const result = await this.generateJson<{ translation: string }>(
      `Translate into ${targetLang === "zh" ? "Simplified Chinese" : "English"}. Return JSON { "translation": string }.\n\n${text}`,
    );
    return String(result.translation ?? text);
  }
}
