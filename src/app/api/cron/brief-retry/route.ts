import { NextResponse } from "next/server";
import { maybeUpgradeBrief } from "@/lib/brief/generate";
import { getRepository } from "@/lib/db";
import { authorizeCron } from "@/lib/cron-auth";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Dedicated brief self-healing endpoint (hourly via GitHub Actions).
 * Lives apart from ingestion on purpose: shared cron paths regularly
 * brush the 60s function cap, which used to starve the retry entirely —
 * leaving users with English rule-based briefs for half a day.
 */
export async function POST(request: Request) {
  const auth = authorizeCron(request);
  if (!auth.ok) return auth.response;
  const repo = await getRepository();
  const upgraded = await maybeUpgradeBrief(repo);
  const brief = await repo.latestBrief();
  return NextResponse.json({
    ok: true,
    upgraded,
    currentEdition: brief?.model ? "ai" : "rule",
    model: brief?.model ?? null,
    generatedAt: brief?.generatedAt,
  });
}

export async function GET(request: Request) {
  return POST(request);
}
