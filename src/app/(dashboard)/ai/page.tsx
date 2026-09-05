import Link from "next/link";
import { StoryRow } from "@/components/news/story-row";
import { getFeedView } from "@/lib/queries";

export const dynamic = "force-dynamic";
export const metadata = { title: "AI Intelligence" };

const TABS = [
  { key: "news", label: "News" },
  { key: "models", label: "Models" },
  { key: "research", label: "Research" },
  { key: "github", label: "GitHub" },
] as const;

/**
 * AI intelligence (product spec §76) — more specialized than a generic
 * category page: news + model releases + research + infra signals.
 */
export default async function AIPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  const active = TABS.find((t) => t.key === tab)?.key ?? "news";

  const provider = active === "models" ? "huggingface" : active === "research" ? "arxiv" : active === "github" ? "github" : undefined;
  const feed =
    active === "news"
      ? await getFeedView({ category: "AI", limit: 25 })
      : await getFeedView({ provider: provider as "huggingface" | "arxiv" | "github" | undefined, category: active === "github" ? "OpenSource" : undefined, limit: 25 });

  return (
    <div className="px-6 pb-16 md:px-10">
      <header className="pt-10 md:pt-14">
        <h1 className="display-headline text-foreground">AI</h1>
        <p className="meta-mono mt-2 text-[11.5px]">
          Models, research, infrastructure and the companies building them.
        </p>
      </header>

      <nav className="mt-6 flex gap-5 border-b border-border">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/ai?tab=${t.key}`}
            className={`-mb-px border-b pb-2 text-[13px] transition-colors duration-150 ${
              active === t.key
                ? "border-foreground text-foreground"
                : "border-transparent text-secondary hover:text-foreground"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      <div className="mt-6">
        {feed.rows.map((row) => (
          <StoryRow key={row.article?.id ?? row.cluster?.id} row={row} />
        ))}
        {feed.rows.length === 0 && (
          <div className="story-row text-[13.5px] text-muted">
            No {active} signals yet. Enable the Hugging Face source in Settings → Sources for model releases.
          </div>
        )}
      </div>
    </div>
  );
}
