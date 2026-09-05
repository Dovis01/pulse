import Link from "next/link";
import { pulseConfig } from "@config/pulse.config";
import { updateInterest } from "@/lib/actions";
import { getRepository } from "@/lib/db";
import { getSystemStatus } from "@/lib/system/status";
import { relativeTime } from "@/lib/time/format";

export const dynamic = "force-dynamic";
export const metadata = { title: "Settings" };

const SECTIONS = [
  ["general", "General"],
  ["appearance", "Appearance"],
  ["sources", "Sources"],
  ["topics", "Topics"],
  ["ai", "AI"],
  ["notifications", "Notifications"],
  ["data", "Data"],
  ["system", "System"],
] as const;

export default async function SettingsPage() {
  const repo = await getRepository();
  const [status, interests, sources, usage] = await Promise.all([
    getSystemStatus(),
    repo.getInterests(),
    repo.listSources(),
    repo.usageSummary(),
  ]);
  const usageByKind = new Map(usage.map((u) => [u.kind, u]));

  return (
    <div className="px-6 pb-16 md:px-10">
      <header className="pt-10 md:pt-14">
        <h1 className="display-headline text-foreground">Settings</h1>
        <nav className="meta-mono mt-4 flex flex-wrap gap-x-4 gap-y-1 text-[11px]">
          {SECTIONS.map(([id, label]) => (
            <a key={id} href={`#${id}`} className="hover:text-foreground">
              {label}
            </a>
          ))}
        </nav>
      </header>

      <div className="mt-8 max-w-3xl space-y-12">
        {/* GENERAL */}
        <Section id="general" title="General">
          <Row label="Site name">
            <span className="text-[14px]">{pulseConfig.site.name}</span>
          </Row>
          <Row label="Tagline">
            <span className="text-[14px]">{pulseConfig.site.tagline}</span>
          </Row>
          <Row label="Timezone">
            <span className="text-[14px]">{pulseConfig.timezone}</span>
          </Row>
        </Section>

        {/* APPEARANCE */}
        <Section id="appearance" title="Appearance">
          <Row label="Theme">
            <span className="meta-mono text-[12px]">
              Light / Dark — toggle in the header or via ⌘K → Switch Theme
            </span>
          </Row>
        </Section>

        {/* SOURCES */}
        <Section id="sources" title="Sources">
          <Row label="Registered">
            <span className="text-[14px]">
              {sources.filter((s) => s.enabled).length} active / {sources.length} total ·{" "}
              <Link href="/settings/sources" className="underline decoration-border underline-offset-4">
                manage
              </Link>
            </span>
          </Row>
        </Section>

        {/* TOPICS */}
        <Section id="topics" title="Topics — your interests">
          <div className="space-y-2">
            {interests.map((interest) => (
              <form key={interest.topic} action={updateInterest} className="flex items-center gap-4">
                <input type="hidden" name="topic" value={interest.topic} />
                <span className="w-48 flex-none text-[14px]">{interest.topic}</span>
                <input
                  type="range"
                  name="weight"
                  min="0"
                  max="1"
                  step="0.1"
                  defaultValue={interest.weight}
                  className="flex-1 accent-[var(--foreground)]"
                />
                <span className="meta-mono w-9 text-right text-[11px] tabular-nums">{interest.weight.toFixed(1)}</span>
                <button
                  type="submit"
                  className="meta-mono flex-none text-[10px] uppercase tracking-[0.12em] text-muted hover:text-foreground"
                >
                  Save
                </button>
              </form>
            ))}
          </div>
        </Section>

        {/* AI */}
        <Section id="ai" title="AI">
          <Row label="Provider">
            <span className="text-[14px]">
              {status.ai.provider} — {status.ai.configured ? `connected · ${status.ai.model}` : "not configured (aggregator mode)"}
            </span>
          </Row>
          <Row label="Status">
            <span className={`text-[14px] ${status.ai.degraded ? "text-cat-security" : "text-cat-markets"}`}>
              {status.ai.degraded ? "degraded" : "healthy"}
            </span>
          </Row>
          <Row label="Budget">
            <span className="meta-mono text-[12px]">
              {pulseConfig.ai.maxCallsPerHour}/hour · {pulseConfig.ai.maxCallsPerDay}/day ·{" "}
              {usageByKind.get("ai_call")?.today ?? 0} calls today
            </span>
          </Row>
          <Row label="Paid AI">
            <span className="meta-mono text-[12px]">ALLOW_PAID_AI={process.env.ALLOW_PAID_AI ?? "false"}</span>
          </Row>
        </Section>

        {/* NOTIFICATIONS */}
        <Section id="notifications" title="Notifications">
          <Row label="Breaking — Telegram">
            <span className={`text-[14px] ${status.telegram ? "text-cat-markets" : "text-muted"}`}>
              {status.telegram ? "configured" : "not configured (add TELEGRAM_BOT_TOKEN / CHAT_ID)"}
            </span>
          </Row>
          <Row label="Rules">
            <span className="meta-mono text-[12px]">
              importance ≥ {pulseConfig.notifications.breakingMinImportance} · max{" "}
              {pulseConfig.notifications.maxAlertsPerDay}/day · quiet{" "}
              {pulseConfig.notifications.quietHours.start}–{pulseConfig.notifications.quietHours.end}
            </span>
          </Row>
          <Row label="Email digest — Resend">
            <span className={`text-[14px] ${status.email ? "text-cat-markets" : "text-muted"}`}>
              {status.email ? "configured" : "not configured (add RESEND_API_KEY, EMAIL_FROM, EMAIL_TO)"}
            </span>
          </Row>
        </Section>

        {/* DATA */}
        <Section id="data" title="Data">
          <Row label="Retention">
            <span className="meta-mono text-[12px]">
              raw content {pulseConfig.retention.rawContentDays}d · articles{" "}
              {pulseConfig.retention.articleDays}d · runs {pulseConfig.retention.runDays}d
            </span>
          </Row>
          <Row label="Database">
            <span className="text-[14px]">
              {status.database === "postgres" ? "PostgreSQL (DATABASE_URL)" : "in-memory demo store — set DATABASE_URL for persistence"}
            </span>
          </Row>
          <Row label="Volume">
            <span className="meta-mono text-[12px]">
              {status.articleCount} articles · {status.clusterCount} clusters
            </span>
          </Row>
        </Section>

        {/* SYSTEM */}
        <Section id="system" title="System">
          <div className="space-y-2">
            <StatusLine label="Database" value={status.database === "postgres" ? "Healthy" : "Demo mode"} ok={true} />
            <StatusLine label="AI pipeline" value={status.ai.degraded ? "Degraded" : status.ai.configured ? "Healthy" : "Aggregator mode"} ok={!status.ai.degraded && status.ai.configured} />
            <StatusLine label="Telegram" value={status.telegram ? "Healthy" : "Not configured"} ok={status.telegram} />
            <StatusLine label="Email" value={status.email ? "Healthy" : "Not configured"} ok={status.email} />
            <Row label="Last cron">
              <span className="meta-mono text-[12px]">{status.lastCronAt ? relativeTime(status.lastCronAt) : "never"}</span>
            </Row>
            <Row label="Last successful fetch">
              <span className="meta-mono text-[12px]">{status.lastSuccessfulFetchAt ? relativeTime(status.lastSuccessfulFetchAt) : "never"}</span>
            </Row>
            <Row label="Sources">
              <span className="meta-mono text-[12px]">
                <span className="text-cat-markets">{status.sourcesHealthy} healthy</span> ·{" "}
                <span className="text-cat-security">{status.sourcesFailing} failing</span>
              </span>
            </Row>
            <Row label="Last daily brief">
              <span className="meta-mono text-[12px]">{status.lastBriefAt ? relativeTime(status.lastBriefAt) : "never"}</span>
            </Row>
          </div>
        </Section>

        {/* COST & USAGE (cost spec §105/§106) */}
        <Section id="cost" title="Cost & usage">
          <div className="space-y-2">
            <UsageLine label="Articles fetched today" value={usageByKind.get("articles_fetched")?.today ?? 0} />
            <UsageLine label="AI calls today" value={usageByKind.get("ai_call")?.today ?? 0} />
            <UsageLine label="AI calls this month" value={usageByKind.get("ai_call")?.month ?? 0} />
            <UsageLine label="GitHub requests" value={usageByKind.get("github_request")?.today ?? 0} />
            <UsageLine label="Telegram alerts" value={usageByKind.get("telegram_alert")?.today ?? 0} />
            <UsageLine label="Emails sent" value={usageByKind.get("email_sent")?.today ?? 0} />
            <div className="flex items-baseline justify-between border-t border-border pt-2">
              <span className="text-[14px] text-foreground">Estimated paid usage</span>
              <span className="meta-mono text-[13px] tabular-nums">$0.00</span>
            </div>
          </div>
        </Section>
      </div>
    </div>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-20">
      <div className="section-rule pb-2 pt-4">
        <h2 className="meta-label !text-secondary">{title}</h2>
      </div>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-border py-2.5 last:border-0">
      <span className="meta-mono flex-none text-[11.5px] uppercase tracking-[0.1em] text-muted">{label}</span>
      <span className="min-w-0 text-right">{children}</span>
    </div>
  );
}

function StatusLine({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <div className="flex items-baseline justify-between border-b border-border py-2.5 last:border-0">
      <span className="text-[14px]">{label}</span>
      <span className={`meta-mono text-[11px] uppercase tracking-[0.1em] ${ok ? "text-cat-markets" : "text-muted"}`}>
        ● {value}
      </span>
    </div>
  );
}

function UsageLine({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-baseline justify-between border-b border-border py-2.5 last:border-0">
      <span className="text-[14px] text-secondary">{label}</span>
      <span className="meta-mono text-[12px] tabular-nums">{value}</span>
    </div>
  );
}
