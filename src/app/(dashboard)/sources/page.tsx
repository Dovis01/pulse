import Link from "next/link";
import { categoryLabel } from "@/components/news/category";
import { getSourcesView } from "@/lib/queries";
import { relativeTime } from "@/lib/time/format";

export const revalidate = 60; // ISR: instant navigation, fresh every minute
export const metadata = { title: "Sources" };

export default async function SourcesPage() {
  const rows = await getSourcesView();
  const enabled = rows.filter((r) => r.source.enabled).length;

  return (
    <div className="px-6 pb-16 md:px-10">
      <header className="pt-10 md:pt-14">
        <h1 className="display-headline text-foreground">Sources</h1>
        <p className="meta-mono mt-2 text-[11.5px]">
          {enabled} active of {rows.length} registered. Manage toggles in Settings → Sources.
        </p>
      </header>

      <ul className="mt-8 max-w-3xl">
        {rows.map(({ source, lastError }) => (
          <li key={source.id} className="story-row flex items-baseline gap-4">
            <span
              className={`cat-dot mt-2 ${lastError ? "bg-cat-security" : source.enabled ? "bg-cat-markets" : "bg-cat-neutral"}`}
              aria-hidden
            />
            <div className="min-w-0 flex-1">
              <div className="headline text-[15.5px] text-foreground">{source.name}</div>
              <div className="meta-mono mt-0.5 text-[11px]">
                {source.provider} · {categoryLabel(source.category)} · authority {source.authorityScore} ·{" "}
                {source.refreshIntervalMinutes} min
                {source.lastFetchedAt ? ` · fetched ${relativeTime(source.lastFetchedAt)}` : " · never fetched"}
                {lastError && <span className="text-cat-security"> · {lastError}</span>}
              </div>
            </div>
            <Link href="/settings/sources" className="meta-mono flex-none text-[11px] text-muted hover:text-foreground">
              Manage
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
