import Link from "next/link";
import { notFound } from "next/navigation";
import { CategoryDot, categoryLabel } from "@/components/news/category";
import { MarkRead, SaveButton } from "@/components/news/save-button";
import { getRepository } from "@/lib/db";
import { getStoryView } from "@/lib/queries";
import { absoluteTime, relativeTime } from "@/lib/time/format";

export const revalidate = 60;
export const metadata = { title: "Story" }; // ISR: instant navigation, fresh every minute


export default async function StoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const view = await getStoryView(slug);
  if (!view) notFound();

  const { cluster, articles, related } = view;
  const repo = await getRepository();
  const savedSet = await repo.savedIds();
  const isSaved = articles.some((a) => savedSet.has(a.id));
  const primary = articles[0];

  const summary = cluster.summaryFull ?? cluster.summaryShort ?? articles[0]?.description;
  const hasAiSummary = Boolean(cluster.summaryModel);

  return (
    <div className="px-6 pb-16 md:px-10">
      <MarkRead articleIds={articles.map((a) => a.id)} />

      <div className="pt-10 md:pt-14">
        <div className="meta-mono flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.12em]">
          <CategoryDot category={cluster.category} />
          <span>{categoryLabel(cluster.category)}</span>
          {cluster.isBreaking && <span className="text-cat-security">● Breaking</span>}
        </div>

        <h1 className="display-headline mt-4 max-w-4xl text-foreground">{cluster.canonicalTitle}</h1>

        <div className="meta-mono mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px]">
          <span>Based on {cluster.sourceCount} report{cluster.sourceCount === 1 ? "" : "s"}</span>
          <span className="text-border-strong">·</span>
          <span title={absoluteTime(cluster.lastUpdatedAt)}>{relativeTime(cluster.lastUpdatedAt)}</span>
          {cluster.countries.length > 0 && (
            <>
              <span className="text-border-strong">·</span>
              <span>{cluster.countries.join(" / ")}</span>
            </>
          )}
          <span className="text-border-strong">·</span>
          <span>{cluster.importanceScore} importance</span>
        </div>

        {primary && (
          <div className="mt-3 flex items-center gap-4">
            <a
              href={primary.url}
              target="_blank"
              rel="noopener noreferrer"
              className="meta-mono text-[11px] uppercase tracking-[0.12em] text-secondary underline decoration-border underline-offset-4 hover:text-foreground"
            >
              Read at {primary.sourceName} ↗
            </a>
            {primary && <SaveButton articleId={primary.id} initialSaved={isSaved} />}
          </div>
        )}
      </div>

      {/* SUMMARY */}
      {summary && (
        <section className="mt-10 max-w-[52rem]">
          <div className="section-rule pb-2 pt-4">
            <h2 className="meta-label !text-secondary">
              {hasAiSummary
                ? `AI Summary · ${cluster.summaryModel ?? ""}`
                : `Summary · composed from ${cluster.sourceCount} report${cluster.sourceCount === 1 ? "" : "s"}`}
            </h2>
          </div>
          <p className="mt-4 whitespace-pre-line text-[16px] leading-[1.8] text-foreground">{summary}</p>
          {hasAiSummary ? (
            <p className="meta-mono mt-3 text-[10.5px]">
              AI-generated summary · {cluster.summaryVersion} · {relativeTime(cluster.summaryGeneratedAt!)} ·
              always verify against the original sources below.
            </p>
          ) : (
            <p className="meta-mono mt-3 text-[10.5px]">
              Rule-based aggregation of source reports · add GEMINI_API_KEY to enable AI synthesis.
            </p>
          )}
        </section>
      )}

      {/* KEY POINTS */}
      {cluster.keyPoints && cluster.keyPoints.length > 0 && (
        <section className="mt-10 max-w-[52rem]">
          <div className="section-rule pb-2 pt-4">
            <h2 className="meta-label !text-secondary">Key points</h2>
          </div>
          <ul className="mt-4 space-y-2">
            {cluster.keyPoints.map((point) => (
              <li key={point} className="flex gap-3 text-[14.5px] leading-relaxed text-secondary">
                <span className="mt-[9px] h-px w-3 flex-none bg-border-strong" />
                {point}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* WHY IT MATTERS */}
      {cluster.whyItMatters && (
        <section className="mt-10 max-w-[52rem]">
          <div className="section-rule pb-2 pt-4">
            <h2 className="meta-label !text-secondary">Why it matters</h2>
          </div>
          <p className="mt-4 text-[15.5px] leading-[1.75] text-foreground">{cluster.whyItMatters}</p>
        </section>
      )}

      {/* TIMELINE */}
      {articles.length > 1 && (
        <section className="mt-10 max-w-[52rem]">
          <div className="section-rule pb-2 pt-4">
            <h2 className="meta-label !text-secondary">Timeline</h2>
          </div>
          <ol className="mt-4">
            {articles.map((a) => (
              <li key={a.id} className="flex gap-4 border-b border-border py-3 last:border-0">
                <span className="meta-mono w-24 flex-none text-[11.5px] tabular-nums" title={absoluteTime(a.publishedAt)}>
                  {relativeTime(a.publishedAt)}
                </span>
                <div className="min-w-0">
                  <div className="meta-mono text-[10.5px] uppercase tracking-[0.12em]">{a.sourceName}</div>
                  <a
                    href={a.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-0.5 block text-[14px] leading-snug text-foreground hover:text-secondary"
                  >
                    {a.title} ↗
                  </a>
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* COVERAGE — source transparency is mandatory (spec §15) */}
      <section className="mt-10 max-w-[52rem]">
        <div className="section-rule pb-2 pt-4">
          <h2 className="meta-label !text-secondary">Coverage</h2>
        </div>
        <p className="meta-mono mt-3 text-[11.5px]">
          {cluster.sourceCount} source{cluster.sourceCount === 1 ? "" : "s"} — every summary links back to
          its reporters.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {[...new Set(articles.map((a) => a.sourceName))].map((name) => {
            const article = articles.find((a) => a.sourceName === name);
            return (
              <a
                key={name}
                href={article?.url ?? "#"}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-sm border border-border px-2.5 py-1 text-[12.5px] text-secondary transition-colors duration-150 hover:border-border-strong hover:text-foreground"
              >
                {name} ↗
              </a>
            );
          })}
        </div>
      </section>

      {/* RELATED */}
      {related.length > 0 && (
        <section className="mt-10 max-w-[52rem]">
          <div className="section-rule pb-2 pt-4">
            <h2 className="meta-label !text-secondary">Related stories</h2>
          </div>
          <ul className="mt-3 divide-y divide-border">
            {related.map((r) => (
              <li key={r.id} className="py-3">
                <Link href={`/story/${r.slug || r.id}`} className="text-[14.5px] text-foreground hover:text-secondary">
                  {r.canonicalTitle}
                </Link>
                <span className="meta-mono ml-3 text-[11px] text-muted">{r.importanceScore}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
