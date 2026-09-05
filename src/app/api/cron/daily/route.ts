import { NextResponse } from "next/server";
import { runDailyTasks } from "@/lib/daily";
import { authorizeCron } from "@/lib/cron-auth";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Daily cron (cost spec §72): Daily Brief + digest + cleanup + metrics. */
export async function POST(request: Request) {
  const auth = authorizeCron(request);
  if (!auth.ok) return auth.response;
  const outcome = await runDailyTasks();
  return NextResponse.json({ ok: true, outcome });
}

export async function GET(request: Request) {
  return POST(request);
}
