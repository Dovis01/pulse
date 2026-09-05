import Link from "next/link";
import { CategoryDot, categoryLabel } from "@/components/news/category";
import { getTimelineView } from "@/lib/queries";
import { absoluteTime } from "@/lib/time/format";

export const revalidate = 60; // ISR: instant navigation, fresh every minute
export const metadata = { title: "Timeline" };

export default async function TimelinePage() {
  const articles = await getTimelineView();

  return (
    <div className="px-6 pb-16 md:px-10">
      <header className="pt-10 md:pt-14">
        <h1 className="display-headline text-foreground">Timeline</h1>
        <p className="meta-mono mt-2 text-[11.5px]">The raw wire. Strict chronological order.</p>
      </header>
      <ol className="mt-8 max-w-3xl">
        {articles.map((a) => (
          <li key={a.id} className="story-row flex gap-5">
            <span className="meta-mono w-20 flex-none pt-1 text-[11.5px] tabular-nums" title={absoluteTime(a.publishedAt)}>
              {new Intl.DateTimeFormat("en-GB", {
                timeZone: "Asia/Tokyo",
                hour: "2-digit",
                minute: "2-digit",
                hour12: false,
              }).format(new Date(a.publishedAt))}
            </span>
            <div className="min-w-0 flex-1">
              <div className="meta-mono flex items-center gap-2 text-[10.5px] uppercase tracking-[0.12em]">
                <CategoryDot category={a.category} />
                <span>{a.sourceName}</span>
                <span className="text-muted">· {categoryLabel(a.category)}</span>
              </div>
              <Link href={`/story/${a.id}`} className="mt-1 block text-[15px] leading-snug text-foreground transition-colors duration-150 hover:text-secondary">
                {a.title}
              </Link>
            </div>
          </li>
        ))}
        {articles.length === 0 && <li className="story-row text-[13.5px] text-muted">Wire is quiet.</li>}
      </ol>
    </div>
  );
}
