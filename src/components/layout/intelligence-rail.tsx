import Link from "next/link";
import type { TodayView } from "@/lib/queries";
import { relativeTime } from "@/lib/time/format";

/**
 * Right intelligence rail (product spec §39): Trending + Live + What changed.
 * Markets block deliberately omitted — not v1-mandatory, and removal > addition.
 */
export function IntelligenceRail({ data }: { data: TodayView }) {
  return (
    <aside className="hidden w-[280px] flex-none overflow-y-auto border-l border-border px-6 py-7 xl:block">
      <div className="mb-9">
        <div className="meta-label mb-3">What changed</div>
        <div className="space-y-1.5 text-[13px] text-secondary">
          <div>
            <span className="meta-mono">SINCE {data.whatChanged.since}</span>
          </div>
          <div>
            <span className="text-foreground">+{data.whatChanged.major}</span> major stories
          </div>
          <div>
            <span className="text-foreground">+{data.whatChanged.breaking}</span> breaking developments
          </div>
        </div>
      </div>

      <div className="mb-9">
        <div className="meta-label mb-3">Trending</div>
        <ol className="space-y-2">
          {data.trending.slice(0, 6).map((t, i) => (
            <li key={t.label} className="flex items-baseline gap-2 text-[13px]">
              <span className="meta-mono w-5 text-[11px] text-muted">{String(i + 1).padStart(2, "0")}</span>
              <Link
                href={`/topic/${t.label.toLowerCase().replace(/\s+/g, "-")}`}
                className="flex-1 truncate text-secondary transition-colors duration-150 hover:text-foreground"
                title={t.label}
              >
                {t.label.replace(/\b\w/g, (c) => c.toUpperCase())}
              </Link>
              <span className="meta-mono text-[11px] text-cat-markets">
                ↑{Math.max(0, t.changePct)}%
              </span>
            </li>
          ))}
          {data.trending.length === 0 && <li className="text-[13px] text-muted">Not enough signal yet.</li>}
        </ol>
      </div>

      <div className="mb-9">
        <div className="meta-label mb-3">Live</div>
        <ul className="space-y-2.5">
          {data.live.slice(0, 6).map((item) => (
            <li key={item.id} className="text-[12.5px] leading-snug">
              <span className="meta-mono mr-2 text-[11px] tabular-nums">
                {relativeTime(item.publishedAt)}
              </span>
              <Link href={`/story/${item.id}`} className="text-secondary transition-colors duration-150 hover:text-foreground">
                {item.sourceName}
              </Link>
            </li>
          ))}
          {data.live.length === 0 && <li className="text-[13px] text-muted">Feed idle.</li>}
        </ul>
      </div>

      <div className="meta-mono border-t border-border pt-4 text-[11px]">
        <div className="flex justify-between">
          <span>Sources</span>
          <span className="tabular-nums">{data.stats.sources}</span>
        </div>
        <div className="mt-1 flex justify-between">
          <span>Stories 24h</span>
          <span className="tabular-nums">{data.stats.stories}</span>
        </div>
        <div className="mt-1 flex justify-between">
          <span>Clusters</span>
          <span className="tabular-nums">{data.stats.clusters}</span>
        </div>
      </div>
    </aside>
  );
}
