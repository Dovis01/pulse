import { NextResponse, type NextRequest } from "next/server";
import { generateBrief } from "@/lib/brief/generate";
import { getRepository } from "@/lib/db";
import { authorizeCron } from "@/lib/cron-auth";
import { isAuthenticated, isAuthEnabled } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** GET latest brief; POST ?generate=1 regenerates (user or cron secret). */
export async function GET() {
  const repo = await getRepository();
  const brief = await repo.latestBrief();
  return NextResponse.json({ brief });
}

export async function POST(request: NextRequest) {
  const cronOk = authorizeCron(request).ok;
  const userOk = isAuthEnabled() ? await isAuthenticated() : true;
  if (!cronOk && !userOk) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const repo = await getRepository();
  const brief = await generateBrief(repo);
  return NextResponse.json({ ok: Boolean(brief), brief });
}
