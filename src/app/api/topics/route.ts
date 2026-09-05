import { NextResponse } from "next/server";
import { getRepository } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const repo = await getRepository();
  const since = new Date(Date.now() - 7 * 24 * 3_600_000).toISOString();
  const [topics, entities] = await Promise.all([
    repo.topTopics(since, 30),
    repo.topEntities(since, 30),
  ]);
  return NextResponse.json({ topics, entities });
}
