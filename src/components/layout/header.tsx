"use client";

import { useEffect, useState } from "react";
import { ThemeToggle } from "@/components/theme-toggle";

/** Live clock in the app timezone — client-only to avoid hydration drift. */
function Clock({ timezone }: { timezone: string }) {
  const [time, setTime] = useState<string | null>(null);
  useEffect(() => {
    const tick = () =>
      setTime(
        new Intl.DateTimeFormat("en-GB", {
          timeZone: timezone,
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        }).format(new Date()),
      );
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, [timezone]);
  const tz = timezone.split("/")[1]?.replace(/_/g, " ") ?? timezone;
  return (
    <span className="meta-mono tabular-nums">
      {time ?? "--:--"} {tz}
    </span>
  );
}

export function Header({ timezone }: { timezone: string }) {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur-sm">
      <div className="flex h-12 items-center justify-between px-6">
        <div className="flex items-center gap-4">
          <button
            type="button"
            data-command-open
            className="meta-mono hidden items-center gap-2 rounded-sm border border-border px-2.5 py-1 text-[11px] transition-colors duration-150 hover:border-border-strong md:flex"
          >
            <span>Search</span>
            <kbd className="text-[10px] text-muted">⌘K</kbd>
          </button>
        </div>
        <div className="flex items-center gap-4">
          <Clock timezone={timezone} />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
