import { StoryRow } from "@/components/news/story-row";
import { getSavedView } from "@/lib/queries";

export const dynamic = "force-dynamic";
export const metadata = { title: "Saved" };

export default async function SavedPage() {
  const rows = await getSavedView();

  return (
    <div className="px-6 pb-16 md:px-10">
      <header className="pt-10 md:pt-14">
        <h1 className="display-headline text-foreground">Saved</h1>
        <p className="meta-mono mt-2 text-[11.5px]">Your long-term knowledge base.</p>
      </header>
      <div className="mt-8">
        {rows.length === 0 ? (
          <div className="story-row">
            <p className="text-[15px] text-secondary">Nothing saved yet.</p>
            <p className="meta-mono mt-1 text-[11.5px]">Stories you save will appear here.</p>
          </div>
        ) : (
          rows.map((row) => <StoryRow key={row.article?.id} row={row} />)
        )}
      </div>
    </div>
  );
}
