import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getRepository } from "@/lib/db";

export const dynamic = "force-dynamic";

const querySchema = z.object({ q: z.string().min(1).max(200) });

export async function GET(request: NextRequest) {
  const parsed = querySchema.safeParse({ q: request.nextUrl.searchParams.get("q") ?? "" });
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid query" }, { status: 400 });
  }
  const repo = await getRepository();
  const { searchEverything } = await import("@/lib/search");
  const results = await searchEverything(repo, parsed.data.q);
  return NextResponse.json({
    stories: results.stories.map((a) => ({
      id: a.id,
      title: a.title,
      sourceName: a.sourceName,
      publishedAt: a.publishedAt,
    })),
    topics: results.topics,
    entities: results.entities,
    sources: results.sources,
  });
}
