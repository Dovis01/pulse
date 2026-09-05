import { NextResponse } from "next/server";
import { authorizeCron } from "@/lib/cron-auth";
import { runIngestion } from "@/lib/news/ingest";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Normal cron (cost spec §71): regular RSS, company blogs, arXiv, HF. */
export async function POST(request: Request) {
  const auth = authorizeCron(request);
  if (!auth.ok) return auth.response;
  const summary = await runIngestion("normal");
  return NextResponse.json({ ok: true, summary });
}

export async function GET(request: Request) {
  return POST(request);
}
