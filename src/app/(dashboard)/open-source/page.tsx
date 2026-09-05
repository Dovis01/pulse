import { StoryRow } from "@/components/news/story-row";
import { getFeedView } from "@/lib/queries";
import { getRepository } from "@/lib/db";
import { pulseConfig } from "@config/pulse.config";
import { sinceHoursAgoIso } from "@/lib/time/format";

export const revalidate = 60; // ISR: instant navigation, fresh every minute
export const metadata = { title: "Open Source Intelligence" };

export default async function OpenSourcePage() {
  const [feed, repo] = await Promise.all([getFeedView({ category: "OpenSource", limit: 25 }), getRepository()]);
  const since = sinceHoursAgoIso(7 * 24);
  const githubStories = await repo.listArticles({ provider: "github", since, limit: 8 });
  const githubCount = githubStories.length;

  return (
    <div className="px-6 pb-16 md:px-10">
      <header className="pt-10 md:pt-14">
        <h1 className="display-headline text-foreground">Open Source</h1>
        <p className="meta-mono mt-2 text-[11.5px]">
          Releases, merged PRs and community velocity across {pulseConfig.github.repositories.length} watchlist
          repos · {githubCount} signals this week.
        </p>
      </header>

      {githubStories.length > 0 && (
        <section className="mt-8">
          <div className="section-rule pb-2 pt-4">
            <h2 className="meta-label !text-secondary">Watchlist activity</h2>
          </div>
          <ul className="divide-y divide-border">
            {githubStories.slice(0, 6).map((a) => (
              <li key={a.id} className="story-row">
                <div className="meta-mono text-[10.5px] uppercase tracking-[0.12em]">{a.sourceName}</div>
                <a
                  href={a.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="headline mt-1 block text-[16px] text-foreground hover:text-secondary"
                >
                  {a.title}
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-8">
        <div className="section-rule pb-2 pt-4">
          <h2 className="meta-label !text-secondary">Coverage</h2>
        </div>
        {feed.rows.map((row) => (
          <StoryRow key={row.article?.id ?? row.cluster?.id} row={row} />
        ))}
        {feed.rows.length === 0 && (
          <div className="story-row text-[13.5px] text-muted">No open-source coverage in the last 24h.</div>
        )}
      </section>
    </div>
  );
}
