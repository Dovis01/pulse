import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

/**
 * Optional single-user auth (product spec §58/§91, cost §92). Enabled only
 * when AUTH_SECRET is set; otherwise the app is open — a missing key must
 * never break startup (cost §32).
 */

export const AUTH_COOKIE = "pulse_session";

export function isAuthEnabled(): boolean {
  return Boolean(process.env.AUTH_SECRET?.trim());
}

function expectedToken(): string {
  return createHmac("sha256", process.env.AUTH_SECRET!.trim()).update("pulse-session-v1").digest("hex");
}

export function createSessionToken(): string {
  return expectedToken();
}

export function verifyToken(token: string | undefined): boolean {
  if (!token || !isAuthEnabled()) return !isAuthEnabled();
  const expected = expectedToken();
  const a = Buffer.from(token);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function isAuthenticated(): Promise<boolean> {
  const store = await cookies();
  return verifyToken(store.get(AUTH_COOKIE)?.value);
}

export function passwordMatches(input: string): boolean {
  const secret = process.env.AUTH_SECRET!.trim();
  const a = Buffer.from(input);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}
