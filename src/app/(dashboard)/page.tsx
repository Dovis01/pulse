import Link from "next/link";
import { Section, StoryRow } from "@/components/news/story-row";
import { IntelligenceRail } from "@/components/layout/intelligence-rail";
import { getTodayView } from "@/lib/queries";
import { greeting, longDate, relativeTime } from "@/lib/time/format";

export const revalidate = 60; // ISR: instant navigation, fresh every minute

/**
 * Today (product spec §9/§75) — hierarchy is fixed:
 * Global Brief → Breaking → Top Stories → For You → AI & Tech → World →
 * Open Source → More. Never a plain reverse-chronological dump.
 */
export default async function TodayPage() {
  const data = await getTodayView();

  return (
    <div className="flex">
      <div className="min-w-0 flex-1 px-6 pb-16 md:px-10">
        {/* Masthead */}
        <div className="pt-10 md:pt-14">
          <div className="meta-label">{longDate()}</div>
          <h1 className="display-headline mt-3 text-foreground">
            {greeting()}
            <br />
            <span className="text-secondary">Here is what matters today.</span>
          </h1>
          <div className="meta-mono mt-4 flex flex-wrap gap-x-4 gap-y-1 text-[11.5px]">
            <span>{data.stats.sources} sources</span>
            <span className="text-border-strong">/</span>
            <span>{data.stats.stories} stories</span>
            <span className="text-border-strong">/</span>
            <span>{data.stats.clusters} clusters</span>
            {data.stats.updatedAt && (
              <>
                <span className="text-border-strong">/</span>
                <span>Updated {relativeTime(data.stats.updatedAt)}</span>
              </>
            )}
          </div>
        </div>

        {/* GLOBAL BRIEF */}
        <section className="mt-10">
          <div className="section-rule flex items-baseline justify-between pb-2 pt-4">
            <h2 className="meta-label !text-secondary">Global Brief</h2>
            {data.briefModel && <span className="meta-mono text-[11px]">AI · {data.briefModel}</span>}
          </div>
          <p className="mt-4 max-w-[52rem] text-[16.5px] leading-[1.75] text-foreground">
            {data.briefIntro}
          </p>
          {data.briefSections.length > 0 && (
            <ul className="mt-4 max-w-[52rem] space-y-1.5">
              {data.briefSections.slice(0, 4).map((s) => (
                <li key={s.label} className="text-[13.5px] leading-relaxed text-secondary">
                  <span className="meta-mono mr-2 text-[10.5px] uppercase tracking-[0.12em] text-muted">
                    {s.label}
                  </span>
                  {s.text}
                </li>
              ))}
            </ul>
          )}
          <Link href="/brief" className="meta-mono mt-4 inline-block text-[11px] text-secondary hover:text-foreground">
            Open the Daily Brief →
          </Link>
        </section>

        {/* BREAKING */}
        {data.breaking.length > 0 && (
          <Section title="Breaking" hint={`${data.breaking.length} developing`}>
            {data.breaking.map((cluster) => (
              <StoryRow
                key={`b-${cluster.id}`}
                row={{
                  cluster,
                  read: false,
                  saved: false,
                  sourceLabel: `${cluster.sourceCount} sources`,
                  sourceCount: cluster.sourceCount,
                }}
              />
            ))}
          </Section>
        )}

        {/* TOP STORIES */}
        <Section title="Top Stories" hint="by importance">
          {data.topStories.map((row) => (
            <StoryRow key={row.cluster?.id ?? row.rank} row={row} showRank />
          ))}
          {data.topStories.length === 0 && <EmptyHint text="No clustered stories yet — run an ingestion pass from Settings → System." />}
        </Section>

        {/* FOR YOU */}
        {data.forYou.length > 0 && (
          <Section title="For You" hint="importance × relevance" moreHref="/for-you">
            {data.forYou.map((row) => (
              <StoryRow key={`f-${row.cluster?.id}`} row={row} showRank />
            ))}
          </Section>
        )}

        {/* AI & TECHNOLOGY */}
        <Section title="AI & Technology" moreHref="/ai">
          {data.ai.map((row) => (
            <StoryRow key={`ai-${row.cluster?.id ?? row.article?.id}`} row={row} />
          ))}
          {data.ai.length === 0 && <EmptyHint text="No AI stories in the last 24h." />}
        </Section>

        {/* WORLD */}
        <Section title="World" moreHref="/topic/world">
          {data.world.map((row) => (
            <StoryRow key={`w-${row.cluster?.id ?? row.article?.id}`} row={row} />
          ))}
          {data.world.length === 0 && <EmptyHint text="Quiet in world news." />}
        </Section>

        {/* OPEN SOURCE */}
        <Section title="Open Source" moreHref="/open-source">
          {data.openSource.map((row) => (
            <StoryRow key={`os-${row.cluster?.id ?? row.article?.id}`} row={row} />
          ))}
          {data.openSource.length === 0 && <EmptyHint text="No open-source signals today." />}
        </Section>

        {/* MORE */}
        <Section title="More" moreHref="/latest">
          {data.more.map((row) => (
            <StoryRow key={`m-${row.cluster?.id ?? row.article?.id}`} row={row} />
          ))}
        </Section>
      </div>

      <IntelligenceRail data={data} />
    </div>
  );
}

function EmptyHint({ text }: { text: string }) {
  return <div className="story-row text-[13.5px] text-muted">{text}</div>;
}
