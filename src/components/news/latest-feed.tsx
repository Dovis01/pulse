"use client";

import { useState } from "react";
import { StoryRowClient } from "./story-row-client";

interface ApiStory {
  id: string;
  title: string;
  category: string;
  source: string;
  publishedAt: string;
  importance: number;
  summary?: string;
  url?: string;
}

/**
 * Client feed with cursor pagination against /api/stories — keeps the page
 * shell static (ISR) while pagination stays interactive.
 */
export function LatestFeed({ initialStories }: { initialStories: ApiStory[] }) {
  const [stories, setStories] = useState(initialStories);
  const [cursor, setCursor] = useState<string | null>(
    initialStories[initialStories.length - 1]?.publishedAt ?? null,
  );
  const [busy, setBusy] = useState(false);

  const loadMore = async () => {
    if (!cursor || busy) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/stories?limit=30&cursor=${encodeURIComponent(cursor)}`);
      if (response.ok) {
        const data = (await response.json()) as { stories: ApiStory[]; nextCursor?: string };
        setStories((prev) => [...prev, ...data.stories]);
        setCursor(data.nextCursor ?? null);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      {stories.map((story) => (
        <StoryRowClient key={story.id} story={story} />
      ))}
      {stories.length === 0 && (
        <div className="story-row text-[13.5px] text-muted">
          Nothing ingested yet. Trigger a refresh from ⌘K → “Refresh feeds”.
        </div>
      )}
      {cursor && (
        <div className="mt-8 border-t border-border pt-5">
          <button
            type="button"
            onClick={loadMore}
            disabled={busy}
            className="meta-mono text-[12px] text-secondary transition-colors duration-150 hover:text-foreground disabled:opacity-50"
          >
            {busy ? "Loading…" : "Load older stories →"}
          </button>
        </div>
      )}
    </div>
  );
}
