import { pulseConfig } from "@config/pulse.config";
import { getRepository } from "@/lib/db";
import type { AIProvider } from "./types";
import { AIRateLimitError } from "./types";
import { GeminiProvider } from "./gemini";
import { OpenAIProvider } from "./openai";

/**
 * AI gate (cost spec §51–53, §61–62, §103, §107–109).
 * - No key / disabled / over budget / rate limited ⇒ provider === null and
 *   Pulse keeps running in aggregator mode. Never auto-upgrades to paid.
 */

export interface AIGate {
  provider: AIProvider | null;
  reason?: string;
  degraded: boolean;
}

const DEGRADE_COOLDOWN_MS = 5 * 60_000;
let degradedUntil = 0;
let degradeReason: string | null = null;

function buildProvider(): AIProvider | null {
  const providerId = pulseConfig.ai.provider.toLowerCase();
  const model = pulseConfig.ai.model;

  if (providerId === "gemini") {
    const key = process.env.GEMINI_API_KEY?.trim();
    return key ? new GeminiProvider(key, model) : null;
  }
  if (providerId === "openai") {
    // Paid provider — requires explicit opt-in.
    if (process.env.ALLOW_PAID_AI !== "true") return null;
    const key = process.env.OPENAI_API_KEY?.trim();
    return key ? new OpenAIProvider(key, model) : null;
  }
  return null;
}

export async function getAIGate(): Promise<AIGate> {
  if (!pulseConfig.ai.enabled) {
    return { provider: null, reason: "AI disabled via AI_ENABLED", degraded: false };
  }
  if (Date.now() < degradedUntil) {
    return { provider: null, reason: degradeReason ?? "AI temporarily degraded", degraded: true };
  }

  const provider = buildProvider();
  if (!provider) {
    return {
      provider: null,
      reason: `No credentials for AI provider "${pulseConfig.ai.provider}" — aggregator mode`,
      degraded: false,
    };
  }

  // Free-tier budget enforcement.
  const repo = await getRepository();
  const now = new Date();
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const hourStart = new Date(now.getTime() - 3_600_000).toISOString();
  const [todayCalls, hourCalls] = await Promise.all([
    repo.usageCountSince("ai_call", dayStart),
    repo.usageCountSince("ai_call", hourStart),
  ]);
  if (todayCalls >= pulseConfig.ai.maxCallsPerDay) {
    return { provider: null, reason: "Daily AI budget exhausted — degrading", degraded: true };
  }
  if (hourCalls >= pulseConfig.ai.maxCallsPerHour) {
    return { provider: null, reason: "Hourly AI budget exhausted — degrading", degraded: true };
  }

  return { provider, degraded: false };
}

/** Mark the provider degraded after a rate-limit response (retry later). */
export function markAIDegraded(reason: string): void {
  degradedUntil = Date.now() + DEGRADE_COOLDOWN_MS;
  degradeReason = reason;
}

/**
 * Run an AI call through the gate. Returns null on any failure — callers
 * MUST treat null as "use the rule-based path", never as a crash.
 */
export async function callAI<T>(
  fn: (provider: AIProvider) => Promise<T>,
): Promise<{ result: T; providerId: string; model: string } | null> {
  const gate = await getAIGate();
  if (!gate.provider) return null;
  const repo = await getRepository();
  try {
    const result = await fn(gate.provider);
    await repo.recordUsage("ai_call", 1, { provider: gate.provider.id, model: gate.provider.model });
    return { result, providerId: gate.provider.id, model: gate.provider.model };
  } catch (error) {
    if (error instanceof AIRateLimitError) {
      markAIDegraded(error.message);
    }
    console.error(
      `[ai] call failed (${gate.provider.id}/${gate.provider.model}):`,
      error instanceof Error ? `${error.name}: ${error.message}` : error,
    );
    return null;
  }
}

export function resetAIDegradedStateForTests(): void {
  degradedUntil = 0;
  degradeReason = null;
}
