import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getRepository } from "@/lib/db";

export const dynamic = "force-dynamic";

const bodySchema = z.object({ articleIds: z.array(z.string().min(1)).min(1).max(100) });

export async function POST(request: NextRequest) {
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
  await repo.markRead(parsed.data.articleIds);
  return NextResponse.json({ ok: true });
}
