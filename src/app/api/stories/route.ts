import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(30),
  cursor: z.string().optional(),
  category: z
    .enum(["AI", "Technology", "OpenSource", "Markets", "Business", "World", "Science", "Cybersecurity", "Other"])
    .optional(),
  provider: z.enum(["rss", "gdelt", "github", "hackernews", "arxiv", "huggingface", "newsapi"]).optional(),
  since: z.string().optional(),
  order: z.enum(["published", "importance"]).default("published"),
});

export async function GET(request: NextRequest) {
  const parsed = querySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid query", issues: parsed.error.issues }, { status: 400 });
  }
  const { limit, cursor, category, provider, since, order } = parsed.data;
  const { getFeedView } = await import("@/lib/queries");
  const feed = await getFeedView({ limit, cursor, category, provider, since, orderBy: order });
  return NextResponse.json({
    stories: feed.rows.map((row) => ({
      id: row.article?.id ?? row.cluster?.id,
      title: row.cluster?.canonicalTitle ?? row.article?.title,
      category: row.cluster?.category ?? row.article?.category,
      source: row.sourceLabel,
      publishedAt: row.cluster?.lastUpdatedAt ?? row.article?.publishedAt,
      importance: row.cluster?.importanceScore ?? row.article?.importanceScore,
      summary: row.cluster?.summaryShort ?? row.article?.description,
      url: row.article?.url ?? row.cluster?.slug,
    })),
    nextCursor: feed.nextCursor,
  });
}
