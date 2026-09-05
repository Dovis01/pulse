import { NextResponse } from "next/server";
import { getRepository } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const repo = await getRepository();
    const articleCount = await repo.countArticles();
    return NextResponse.json({
      ok: true,
      mode: repo.kind,
      articleCount,
      time: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "unknown" },
      { status: 500 },
    );
  }
}
