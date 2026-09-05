import { NextResponse } from "next/server";
import { isAuthenticated, isAuthEnabled } from "@/lib/auth";
import { getRepository } from "@/lib/db";
import { runIngestion } from "@/lib/news/ingest";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Manual refresh (product spec §57 POST /api/admin/refresh). Allowed for the
 * logged-in single user, or via cron secret (⌘K "Refresh feeds" posts here).
 * Runs the fast group only — serverless functions cap at ~60s, and the
 * normal group has its own hourly cron/admin path.
 */
export async function POST() {
  if (isAuthEnabled() && !(await isAuthenticated())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const repo = await getRepository();
  const fast = await runIngestion("fast", { force: true, repo });
  const clusterCount = await repo.countClusters(
    new Date(Date.now() - 24 * 3_600_000).toISOString(),
  );
  return NextResponse.json({
    ok: true,
    fast,
    clustersLast24h: clusterCount,
    note: "normal group runs on its hourly cron; POST /api/cron/normal to trigger it now",
  });
}
