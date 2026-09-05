import Link from "next/link";
import { CategoryDot, categoryLabel } from "./category";
import { SaveButton } from "./save-button";
import type { StoryRowView } from "@/lib/queries";
import { relativeTime } from "@/lib/time/format";

/**
 * Story row (product spec §80): border-top, generous padding, typography
 * first. No cards, no shadows. Structure:
 *   CATEGORY · TIME / HEADLINE / summary / SOURCE + N   SCORE
 */
export function StoryRow({ row, showRank = false }: { row: StoryRowView; showRank?: boolean }) {
  const cluster = row.cluster;
  const article = row.article;
  const href = cluster ? `/story/${cluster.slug || cluster.id}` : article ? `/story/${article.id}` : "#";
  const title = cluster?.canonicalTitle ?? article?.title ?? "";
  const summary =
    cluster?.summaryShort ?? cluster?.summaryFull?.slice(0, 180) ?? article?.description ?? "";
  const category = cluster?.category ?? article?.category ?? "Other";
  const time = cluster?.lastUpdatedAt ?? article?.publishedAt;
  const score = cluster?.importanceScore ?? article?.importanceScore ?? 0;
  const sources = row.cluster
    ? row.sourceLabel
    : `${article?.sourceName ?? ""}`;
  const sourceCount = row.cluster?.sourceCount ?? 1;

  return (
    <article className={`story-row group ${row.read ? "read-dim" : ""}`}>
      <div className="flex items-baseline gap-3">
        {showRank && row.rank != null && (
          <span className="meta-mono flex-none text-[12px] tabular-nums text-muted">
            {String(row.rank).padStart(2, "0")}
          </span>
        )}
        <div className="meta-mono flex min-w-0 flex-1 items-center gap-2 text-[11px] uppercase tracking-[0.1em]">
          <CategoryDot category={category} />
          <span className="truncate">{categoryLabel(category)}</span>
          {cluster?.isBreaking && <span className="text-cat-security">● Breaking</span>}
          {time && <span className="text-muted">· {relativeTime(time)}</span>}
        </div>
        <div
          className="meta-mono flex flex-none items-center gap-1.5 text-[12px] tabular-nums text-secondary"
          title={`Importance ${score}/100 — weighted from source authority, coverage breadth, velocity and recency`}
        >
          <span className="score-gauge" aria-hidden>
            <span style={{ width: `${Math.max(0, Math.min(100, score))}%` }} />
          </span>
          {score}
        </div>
      </div>

      <Link href={href} className="mt-2 block">
        <h3 className="headline max-w-[46rem] text-[19px] leading-[1.25] text-foreground md:text-[21px]">
          {title}
        </h3>
      </Link>

      {summary && (
        <p className="mt-1.5 max-w-[46rem] text-[14px] leading-relaxed text-secondary">{summary}</p>
      )}

      <div className="mt-2.5 flex items-center gap-3">
        <div className="meta-mono flex min-w-0 flex-1 items-center gap-1.5 text-[11.5px]">
          <Link
            href={article ? article.url : href}
            target="_blank"
            rel="noopener noreferrer"
            className="truncate text-secondary underline decoration-border underline-offset-4 transition-colors duration-150 hover:text-foreground"
          >
            {sources}
          </Link>
          {row.cluster && sourceCount > 1 && (
            <Link href={href} className="text-muted">
              + {sourceCount - 1} more
            </Link>
          )}
        </div>
        {article && <SaveButton articleId={article.id} initialSaved={row.saved} />}
        {cluster && row.saved && <span className="meta-mono text-[11px] text-muted">● Saved</span>}
      </div>
    </article>
  );
}

/** Section header with hairline rules (spec: no cards; rules + spacing). */
export function Section({
  title,
  hint,
  children,
  moreHref,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
  moreHref?: string;
}) {
  return (
    <section className="mt-10">
      <div className="section-rule flex items-baseline justify-between pb-2 pt-4">
        <h2 className="meta-label !text-secondary">{title}</h2>
        <div className="flex items-center gap-3">
          {hint && <span className="meta-mono text-[11px]">{hint}</span>}
          {moreHref && (
            <Link href={moreHref} className="meta-mono text-[11px] text-secondary hover:text-foreground">
              More →
            </Link>
          )}
        </div>
      </div>
      <div className="divide-y divide-border">{children}</div>
    </section>
  );
}
