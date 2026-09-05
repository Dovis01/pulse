import { NextResponse } from "next/server";
import { getRepository } from "@/lib/db";
import { getTrendingSignals } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function GET() {
  const signals = await getTrendingSignals();
  const repo = await getRepository();
  const since = new Date(Date.now() - 7 * 24 * 3_600_000).toISOString();
  const [topics, entities] = await Promise.all([
    repo.topTopics(since, 10),
    repo.topEntities(since, 10),
  ]);
  return NextResponse.json({ signals, topics, entities });
}
