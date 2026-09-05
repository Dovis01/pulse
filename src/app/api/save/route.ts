import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getRepository } from "@/lib/db";
import { isAuthenticated, isAuthEnabled } from "@/lib/auth";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  articleId: z.string().uuid().or(z.string().min(1)),
  saved: z.boolean(),
});

export async function POST(request: NextRequest) {
  if (isAuthEnabled() && !(await isAuthenticated())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid body", issues: parsed.error.issues }, { status: 400 });
  }
  const repo = await getRepository();
  const found = await repo.setSaved(parsed.data.articleId, parsed.data.saved);
  if (!found) {
    return NextResponse.json({ error: "article not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, saved: parsed.data.saved });
}
