"use client";

import { useEffect, useState } from "react";
import { StoryRowClient, type ApiStory } from "./story-row-client";

const TABS = [
  { key: "news", label: "News", params: "category=AI" },
  { key: "models", label: "Models", params: "provider=huggingface" },
  { key: "research", label: "Research", params: "provider=arxiv" },
  { key: "github", label: "GitHub", params: "provider=github" },
] as const;

/** Client tabs over /api/stories — keeps the AI page shell static (ISR). */
export function AiTabs() {
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("news");
  const [stories, setStories] = useState<ApiStory[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const active = TABS.find((t) => t.key === tab);
    if (!active) return;
    let cancelled = false;
    // setState off the synchronous effect body (react-hooks/set-state-in-effect)
    const busyTimer = setTimeout(() => {
      if (!cancelled) setBusy(true);
    }, 0);
    fetch(`/api/stories?${active.params}&limit=25`)
      .then((response) => (response.ok ? response.json() : { stories: [] }))
      .then((data: { stories: ApiStory[] }) => {
        if (!cancelled) setStories(data.stories ?? []);
      })
      .finally(() => {
        clearTimeout(busyTimer);
        if (!cancelled) setBusy(false);
      });
    return () => {
      cancelled = true;
      clearTimeout(busyTimer);
    };
  }, [tab]);

  return (
    <div>
      <nav className="mt-6 flex gap-5 border-b border-border">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`-mb-px border-b pb-2 text-[13px] transition-colors duration-150 ${
              tab === t.key
                ? "border-foreground text-foreground"
                : "border-transparent text-secondary hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <div className="mt-6">
        {busy && stories.length === 0 && (
          <div className="story-row space-y-2">
            <div className="skeleton h-4 w-1/3" />
            <div className="skeleton h-6 w-2/3" />
            <div className="skeleton h-3 w-1/2" />
          </div>
        )}
        {!busy && stories.length === 0 && (
          <div className="story-row text-[13.5px] text-muted">
            No signals in this tab yet — enable more sources in Settings → Sources.
          </div>
        )}
        {stories.map((story) => (
          <StoryRowClient key={story.id} story={story} />
        ))}
      </div>
    </div>
  );
}
