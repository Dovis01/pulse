import { NextResponse } from "next/server";
import { authorizeCron } from "@/lib/cron-auth";
import { runIngestion } from "@/lib/news/ingest";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Fast cron (cost spec §70): breaking RSS + GDELT + HN + GitHub watchlist. */
export async function POST(request: Request) {
  const auth = authorizeCron(request);
  if (!auth.ok) return auth.response;
  const summary = await runIngestion("fast");
  return NextResponse.json({ ok: true, summary });
}

export async function GET(request: Request) {
  return POST(request);
}
