import type { ClassificationInput, DailyBriefInput, StorySummaryInput } from "@prompts";

/**
 * AI provider abstraction (cost spec §49). The application never depends on
 * a concrete vendor — Pulse must keep working if the provider disappears.
 */

export type { ClassificationInput, DailyBriefInput, StorySummaryInput };

export interface ClusterSummaryResult {
  summary_short: string;
  summary_full: string;
  why_it_matters: string;
  key_points: string[];
}

export interface BriefSynthesis {
  intro: string;
  sections: { label: string; text: string }[];
  watch: string[];
  /** Simplified-Chinese edition (same shape), when the provider supports it. */
  introZh?: string;
  sectionsZh?: { label: string; text: string }[];
  watchZh?: string[];
}

export interface ClassifyResult {
  category: string;
  topics: string[];
  entities: string[];
}

export interface AIProvider {
  readonly id: string;
  readonly model: string;
  summarizeCluster(input: StorySummaryInput): Promise<ClusterSummaryResult>;
  synthesizeBrief(input: DailyBriefInput): Promise<BriefSynthesis>;
  classify(input: ClassificationInput): Promise<ClassifyResult>;
  translate(text: string, targetLang: "zh" | "en"): Promise<string>;
}

export class AIRateLimitError extends Error {
  constructor(message = "AI provider rate limited") {
    super(message);
    this.name = "AIRateLimitError";
  }
}
