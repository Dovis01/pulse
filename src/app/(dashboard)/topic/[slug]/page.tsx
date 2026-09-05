import { StoryRow } from "@/components/news/story-row";
import { getTopicView } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return { title: decodeURIComponent(slug).replace(/-/g, " ") };
}

export default async function TopicPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const view = await getTopicView(slug);

  if (!view) {
    return (
      <div className="px-6 py-16">
        <h1 className="display-headline text-foreground">Unknown topic</h1>
      </div>
    );
  }

  return (
    <div className="px-6 pb-16 md:px-10">
      <header className="pt-10 md:pt-14">
        <h1 className="display-headline text-foreground">{view.label}</h1>
        <p className="meta-mono mt-2 text-[11.5px]">
          {view.total} stories · last 7 days
        </p>
      </header>

      {view.topEntities.length > 0 && (
        <div className="mt-6 flex flex-wrap gap-2">
          {view.topEntities.map((e) => (
            <span key={e.label} className="meta-mono rounded-sm border border-border px-2.5 py-1 text-[11px] text-secondary">
              {e.label.replace(/\b\w/g, (c) => c.toUpperCase())} <span className="text-muted">{e.current}</span>
            </span>
          ))}
        </div>
      )}

      <div className="mt-8 max-w-3xl">
        {view.articles.map((a) => (
          <StoryRow
            key={a.id}
            row={{
              article: a,
              read: false,
              saved: false,
              sourceLabel: a.sourceName,
              sourceCount: 1,
            }}
          />
        ))}
        {view.articles.length === 0 && (
          <div className="story-row text-[13.5px] text-muted">No coverage for this topic yet.</div>
        )}
      </div>
    </div>
  );
}
