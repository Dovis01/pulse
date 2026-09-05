import { pulseConfig } from "@config/pulse.config";

/** Time display (product spec §74): DB is UTC, UI renders in app timezone. */

export function relativeTime(iso: string, now = new Date()): string {
  const seconds = Math.max(0, (now.getTime() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return `${Math.floor(seconds)}s ago`;
  const minutes = seconds / 60;
  if (minutes < 60) return `${Math.floor(minutes)} min ago`;
  const hours = minutes / 60;
  if (hours < 24) return `${Math.floor(hours)} h ago`;
  const days = hours / 24;
  if (days < 7) return `${Math.floor(days)} d ago`;
  return formatDateShort(new Date(iso));
}

export function absoluteTime(iso: string, timezone: string = pulseConfig.timezone): string {
  const tzLabel = timezone.split("/")[1]?.replace(/_/g, " ") ?? timezone;
  return `${new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso)).replace("T", " ")} ${tzLabel}`;
}

export function formatDateShort(date: Date, timezone: string = pulseConfig.timezone): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    month: "short",
    day: "numeric",
  }).format(date);
}

export function longDate(timezone: string = pulseConfig.timezone, now = new Date()): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(now);
}

export function greeting(timezone: string = pulseConfig.timezone, now = new Date()): string {
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", { timeZone: timezone, hour: "2-digit", hour12: false }).format(now),
  );
  if (hour < 5) return "Working late.";
  if (hour < 12) return "Good morning.";
  if (hour < 18) return "Good afternoon.";
  return "Good evening.";
}

/** ISO timestamp `hours` before now — kept in lib so pages stay pure. */
export function sinceHoursAgoIso(hours: number, now = new Date()): string {
  return new Date(now.getTime() - hours * 3_600_000).toISOString();
}

/** A sync is "live" when the last run finished within 10 minutes. */
export function isLiveSync(lastSyncIso: string | undefined, now = new Date()): boolean {
  if (!lastSyncIso) return false;
  return now.getTime() - new Date(lastSyncIso).getTime() < 10 * 60_000;
}

/** Local "08:00" cutoff in app timezone → UTC ISO for "what changed today". */
export function localCutoffIso(hour: number, timezone: string = pulseConfig.timezone, now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  // Build the UTC instant whose local time equals today at `hour`.
  const asUTC = (y: string, m: string, d: string, h: string, min: string, s: string) =>
    new Date(`${y}-${m}-${d}T${h}:${min}:${s}Z`).getTime();
  const guess = asUTC(get("year"), get("month"), get("day"), String(hour).padStart(2, "0"), "00", "00");
  // Correct for zone offset by re-formatting the guess.
  const localHourOfGuess = Number(
    new Intl.DateTimeFormat("en-GB", { timeZone: timezone, hour: "2-digit", hour12: false }).format(new Date(guess)),
  );
  const diff = (localHourOfGuess - hour) * 3_600_000;
  return new Date(guess - diff).toISOString();
}
