import Link from "next/link";
import { getRepository } from "@/lib/db";
import { sinceHoursAgoIso } from "@/lib/time/format";

export const dynamic = "force-dynamic";
export const metadata = { title: "Topics" };

export default async function TopicsPage() {
  const repo = await getRepository();
  const since = sinceHoursAgoIso(7 * 24);
  const [topics, entities] = await Promise.all([
    repo.topTopics(since, 24),
    repo.topEntities(since, 16),
  ]);

  return (
    <div className="px-6 pb-16 md:px-10">
      <header className="pt-10 md:pt-14">
        <h1 className="display-headline text-foreground">Topics</h1>
        <p className="meta-mono mt-2 text-[11.5px]">What the feed has been about this week.</p>
      </header>

      <section className="mt-8 max-w-3xl">
        <div className="meta-label pb-3">Topics</div>
        <div className="flex flex-wrap gap-2">
          {topics.map((t) => (
            <Link
              key={t.label}
              href={`/topic/${t.label.toLowerCase().replace(/\s+/g, "-")}`}
              className="rounded-sm border border-border px-3 py-1.5 text-[13px] text-secondary transition-colors duration-150 hover:border-border-strong hover:text-foreground"
            >
              {t.label.replace(/\b\w/g, (c) => c.toUpperCase())}
              <span className="meta-mono ml-2 text-[11px] text-muted">{t.current}</span>
            </Link>
          ))}
          {topics.length === 0 && <p className="text-[13.5px] text-muted">No topics yet.</p>}
        </div>
      </section>

      <section className="mt-10 max-w-3xl">
        <div className="meta-label pb-3">Entities</div>
        <div className="flex flex-wrap gap-2">
          {entities.map((e) => (
            <Link
              key={e.label}
              href={`/topic/${e.label.toLowerCase().replace(/\s+/g, "-")}`}
              className="rounded-sm border border-border px-3 py-1.5 text-[13px] text-secondary transition-colors duration-150 hover:border-border-strong hover:text-foreground"
            >
              {e.label.replace(/\b\w/g, (c) => c.toUpperCase())}
              <span className="meta-mono ml-2 text-[11px] text-muted">{e.current}</span>
            </Link>
          ))}
          {entities.length === 0 && <p className="text-[13.5px] text-muted">No entities yet.</p>}
        </div>
      </section>
    </div>
  );
}
