import { StoryRow } from "@/components/news/story-row";
import { getForYouView } from "@/lib/queries";

export const dynamic = "force-dynamic";
export const metadata = { title: "For You" };

export default async function ForYouPage() {
  const rows = await getForYouView();
  return (
    <div className="px-6 pb-16 md:px-10">
      <header className="pt-10 md:pt-14">
        <h1 className="display-headline text-foreground">For You</h1>
        <p className="meta-mono mt-2 text-[11.5px]">
          final = importance × 0.55 + relevance × 0.45 · tuned in Settings → Topics
        </p>
      </header>
      <div className="mt-8">
        {rows.map((row) => (
          <StoryRow key={row.cluster?.id} row={row} showRank />
        ))}
        {rows.length === 0 && (
          <div className="story-row text-[13.5px] text-muted">
            No stories pass your relevance threshold yet. Raise interest weights in Settings → Topics.
          </div>
        )}
      </div>
    </div>
  );
}
