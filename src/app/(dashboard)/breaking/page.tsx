import { StoryRow } from "@/components/news/story-row";
import { getBreakingView } from "@/lib/queries";

export const revalidate = 60; // ISR: instant navigation, fresh every minute
export const metadata = { title: "Breaking" };

export default async function BreakingPage() {
  const rows = await getBreakingView();
  return (
    <div className="px-6 pb-16 md:px-10">
      <header className="pt-10 md:pt-14">
        <div className="meta-label flex items-center gap-2">
          <span className="cat-dot bg-cat-security" /> Breaking
        </div>
        <h1 className="display-headline mt-3 text-foreground">Developing now.</h1>
        <p className="meta-mono mt-2 text-[11.5px]">
          Velocity × source diversity × authority × cross-region coverage. Threshold 85.
        </p>
      </header>
      <div className="mt-8">
        {rows.map((row) => (
          <StoryRow key={row.cluster?.id} row={row} />
        ))}
        {rows.length === 0 && (
          <div className="story-row text-[13.5px] text-muted">
            No breaking developments in the last 24 hours. That is usually good news.
          </div>
        )}
      </div>
    </div>
  );
}
