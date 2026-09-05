import { redirect } from "next/navigation";
import { AUTH_COOKIE, createSessionToken, isAuthenticated, isAuthEnabled, passwordMatches } from "@/lib/auth";
import { pulseConfig } from "@config/pulse.config";

export const metadata = { title: "Sign in" };

async function login(formData: FormData): Promise<void> {
  "use server";
  if (!isAuthEnabled()) {
    redirect("/");
  }
  const password = String(formData.get("password") ?? "");
  if (!passwordMatches(password)) {
    redirect("/login?error=1");
  }
  const { cookies } = await import("next/headers");
  const store = await cookies();
  store.set(AUTH_COOKIE, createSessionToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  });
  redirect("/");
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (!isAuthEnabled() || (await isAuthenticated())) {
    redirect("/");
  }
  const { error } = await searchParams;

  return (
    <div className="mx-auto flex min-h-screen max-w-[400px] flex-col justify-center px-6">
      <div className="headline text-[20px]">
        {pulseConfig.site.name} <span className="text-muted">/</span>
      </div>
      <p className="meta-mono mt-2 text-[11px] uppercase tracking-[0.14em]">Global Intelligence Feed</p>

      <form action={login} className="mt-8 space-y-3">
        <input
          type="password"
          name="password"
          placeholder="Access secret (AUTH_SECRET)"
          autoFocus
          className="w-full border border-border bg-surface px-3 py-2.5 text-[14px] outline-none focus:border-border-strong"
        />
        {error && <p className="meta-mono text-[11px] text-cat-security">Invalid secret.</p>}
        <button
          type="submit"
          className="meta-mono w-full border border-border-strong bg-foreground px-3 py-2.5 text-[11px] uppercase tracking-[0.14em] text-background transition-opacity duration-150 hover:opacity-90"
        >
          Enter
        </button>
      </form>
      {process.env.ALLOWED_EMAIL && (
        <p className="meta-mono mt-6 text-[10.5px] text-muted">Allowlisted: {process.env.ALLOWED_EMAIL}</p>
      )}
    </div>
  );
}
