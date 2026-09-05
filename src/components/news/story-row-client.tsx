import Link from "next/link";
import { CategoryDot, categoryLabel } from "./category";
import { relativeTimeClient } from "./relative-time-client";

export interface ApiStory {
  id: string;
  title: string;
  category: string;
  source: string;
  publishedAt: string;
  importance: number;
  summary?: string;
  url?: string;
}

/** Lightweight story row for client-rendered feeds (latest page tabs). */
export function StoryRowClient({ story }: { story: ApiStory }) {
  return (
    <article className="story-row">
      <div className="flex items-baseline gap-3">
        <div className="meta-mono flex min-w-0 flex-1 items-center gap-2 text-[11px] uppercase tracking-[0.1em]">
          <CategoryDot category={story.category} />
          <span className="truncate">{categoryLabel(story.category)}</span>
          <span className="text-muted">· {relativeTimeClient(story.publishedAt)}</span>
        </div>
        <div className="meta-mono flex-none text-[12px] tabular-nums text-secondary" title="Importance">
          {story.importance}
        </div>
      </div>
      <Link href={`/story/${story.id}`} className="mt-2 block">
        <h3 className="headline max-w-[46rem] text-[19px] leading-[1.25] text-foreground md:text-[21px]">
          {story.title}
        </h3>
      </Link>
      {story.summary && (
        <p className="mt-1.5 max-w-[46rem] text-[14px] leading-relaxed text-secondary">{story.summary}</p>
      )}
      <div className="mt-2.5">
        {story.url && (
          <a
            href={story.url}
            target="_blank"
            rel="noopener noreferrer"
            className="meta-mono truncate text-secondary underline decoration-border underline-offset-4 transition-colors duration-150 hover:text-foreground"
          >
            {story.source}
          </a>
        )}
      </div>
    </article>
  );
}
