import { toggleSource } from "@/lib/actions";
import { getSourcesView } from "@/lib/queries";
import { relativeTime } from "@/lib/time/format";

export const dynamic = "force-dynamic";
export const metadata = { title: "Manage Sources" };

export default async function ManageSourcesPage() {
  const rows = await getSourcesView();

  return (
    <div className="px-6 pb-16 md:px-10">
      <header className="pt-10 md:pt-14">
        <h1 className="display-headline text-foreground">Sources</h1>
        <p className="meta-mono mt-2 text-[11.5px]">
          Registry-driven — feeds are never hard-coded in pages (cost spec §11).
        </p>
      </header>

      <ul className="mt-8 max-w-3xl">
        {rows.map(({ source, lastError }) => (
          <li key={source.id} className="story-row">
            <div className="flex items-baseline justify-between gap-4">
              <div className="min-w-0">
                <div className="headline text-[15.5px] text-foreground">{source.name}</div>
                <div className="meta-mono mt-0.5 text-[11px]">
                  {source.provider} · authority {source.authorityScore} · every {source.refreshIntervalMinutes} min ·{" "}
                  {source.group}
                  {source.lastFetchedAt ? ` · ${relativeTime(source.lastFetchedAt)}` : " · never fetched"}
                  {lastError && <span className="text-cat-security"> · {lastError}</span>}
                </div>
              </div>
              <form action={toggleSource}>
                <input type="hidden" name="id" value={source.id} />
                <button
                  type="submit"
                  className={`meta-mono flex-none rounded-sm border px-2.5 py-1 text-[10px] uppercase tracking-[0.12em] transition-colors duration-150 ${
                    source.enabled
                      ? "border-border text-foreground hover:border-border-strong"
                      : "border-border text-muted hover:text-secondary"
                  }`}
                >
                  {source.enabled ? "● Active" : "○ Off"}
                </button>
              </form>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
