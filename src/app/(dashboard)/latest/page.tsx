import { StoryRow } from "@/components/news/story-row";
import { getFeedView } from "@/lib/queries";
import Link from "next/link";

export const dynamic = "force-dynamic";
export const metadata = { title: "Latest" };

export default async function LatestPage({
  searchParams,
}: {
  searchParams: Promise<{ cursor?: string }>;
}) {
  const { cursor } = await searchParams;
  const { rows, nextCursor } = await getFeedView({ limit: 30, cursor });

  return (
    <div className="px-6 pb-16 md:px-10">
      <header className="pt-10 md:pt-14">
        <h1 className="display-headline text-foreground">Latest</h1>
        <p className="meta-mono mt-2 text-[11.5px]">Strict feed, newest first. Raw coverage before clustering.</p>
      </header>
      <div className="mt-8">
        {rows.map((row) => (
          <StoryRow key={row.article?.id ?? row.cluster?.id} row={row} />
        ))}
        {rows.length === 0 && (
          <div className="story-row text-[13.5px] text-muted">
            Nothing ingested yet. Trigger a refresh from ⌘K → “Refresh feeds”.
          </div>
        )}
      </div>
      {nextCursor && (
        <div className="mt-8 border-t border-border pt-5">
          <Link href={`/latest?cursor=${encodeURIComponent(nextCursor)}`} className="meta-mono text-[12px] text-secondary hover:text-foreground">
            Load older stories →
          </Link>
        </div>
      )}
    </div>
  );
}
