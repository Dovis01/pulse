import { NextResponse } from "next/server";

/**
 * Cron security (cost spec §73): every cron route validates the
 * Authorization: Bearer CRON_SECRET header. Vercel Cron sends it
 * automatically when CRON_SECRET is configured. Without a configured
 * secret, requests are only allowed outside production so local testing
 * works — public calls are always rejected in production.
 */
export function authorizeCron(request: Request): { ok: true } | { ok: false; response: NextResponse } {
  const secret = process.env.CRON_SECRET?.trim();
  const isProduction = process.env.NODE_ENV === "production" || Boolean(process.env.VERCEL);

  if (!secret) {
    if (isProduction) {
      return {
        ok: false,
        response: NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 }),
      };
    }
    return { ok: true };
  }

  const header = request.headers.get("authorization") ?? "";
  if (header !== `Bearer ${secret}`) {
    return { ok: false, response: NextResponse.json({ error: "unauthorized" }, { status: 401 }) };
  }
  return { ok: true };
}
