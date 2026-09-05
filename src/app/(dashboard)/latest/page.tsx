import { LatestFeed } from "@/components/news/latest-feed";
import { getRepository } from "@/lib/db";
import type { Article } from "@/lib/news/types";

export const revalidate = 60; // ISR: instant navigation, fresh every minute
export const metadata = { title: "Latest" };

export default async function LatestPage() {
  const repo = await getRepository();
  const articles = await repo.listArticles({ limit: 50, orderBy: "published" });
  const initialStories = articles.map((a: Article) => ({
    id: a.id,
    title: a.title,
    category: a.category,
    source: a.sourceName,
    publishedAt: a.publishedAt,
    importance: a.importanceScore,
    summary: a.description?.slice(0, 200),
    url: a.url,
  }));

  return (
    <div className="px-6 pb-16 md:px-10">
      <header className="pt-10 md:pt-14">
        <h1 className="display-headline text-foreground">Latest</h1>
        <p className="meta-mono mt-2 text-[11.5px]">
          Strict feed, newest first. Raw coverage before clustering.
        </p>
      </header>
      <div className="mt-8">
        <LatestFeed initialStories={initialStories} />
      </div>
    </div>
  );
}
