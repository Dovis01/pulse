"use client";

import { useEffect, useState, useTransition } from "react";

/** Save/unsave control — optimistic, posts to /api/save (spec §41). */
export function SaveButton({ articleId, initialSaved }: { articleId: string; initialSaved: boolean }) {
  const [saved, setSaved] = useState(initialSaved);
  const [pending, startTransition] = useTransition();

  const toggle = () => {
    const next = !saved;
    setSaved(next);
    startTransition(async () => {
      try {
        const response = await fetch("/api/save", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ articleId, saved: next }),
        });
        if (!response.ok) throw new Error("save failed");
      } catch {
        setSaved(!next);
      }
    });
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={saved}
      aria-label={saved ? "Remove from saved" : "Save story"}
      className={`meta-mono flex-none text-[11px] uppercase tracking-[0.1em] transition-colors duration-150 ${
        saved ? "text-foreground" : "text-muted hover:text-secondary"
      } ${pending ? "opacity-60" : ""}`}
    >
      {saved ? "● Saved" : "○ Save"}
    </button>
  );
}

/** Marks stories as read when a story page opens (spec §42). */
export function MarkRead({ articleIds }: { articleIds: string[] }) {
  const key = articleIds.join(",");
  useEffect(() => {
    if (!key) return;
    void fetch("/api/read", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ articleIds: key.split(",") }),
    }).catch(() => undefined);
  }, [key]);
  return null;
}
