"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

interface SearchPayload {
  stories: { id: string; title: string; sourceName: string; publishedAt: string }[];
  topics: { label: string }[];
  entities: { label: string }[];
  sources: { name: string; category: string }[];
}

const COMMANDS = [
  { label: "Go to Today", href: "/" },
  { label: "Go to Latest", href: "/latest" },
  { label: "Open Daily Brief", href: "/brief" },
  { label: "Go to AI", href: "/ai" },
  { label: "Go to Open Source", href: "/open-source" },
  { label: "Go to Timeline", href: "/timeline" },
  { label: "Open Settings", href: "/settings" },
];

/**
 * Command palette + global search (product spec §37/§38). Custom-built —
 * no UI-kit styling; references developer tools, not news sites.
 */
export function CommandMenu() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchPayload | null>(null);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setResults(null);
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((v) => !v);
      }
      if (event.key === "Escape") close();
    };
    const onClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (target.closest("[data-command-open]")) {
        event.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("click", onClick);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("click", onClick);
    };
  }, [close]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 30);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const trimmed = query.trim();
    // All state updates happen inside the debounce callback, never
    // synchronously in the effect body.
    const id = setTimeout(async () => {
      if (trimmed.length < 2) {
        setResults(null);
        setBusy(false);
        return;
      }
      setBusy(true);
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}`);
        if (response.ok) setResults((await response.json()) as SearchPayload);
      } finally {
        setBusy(false);
      }
    }, 220);
    return () => clearTimeout(id);
  }, [query, open]);

  if (!open) return null;

  const go = (href: string) => {
    close();
    router.push(href);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 pt-[12vh] fade-in"
      onClick={close}
      role="presentation"
    >
      <div
        className="w-[min(640px,92vw)] border border-border-strong bg-surface shadow-lg"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Search and commands"
      >
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search stories, topics, sources…"
          className="w-full border-b border-border bg-transparent px-4 py-3.5 text-[15px] outline-none placeholder:text-muted"
        />
        <div className="max-h-[52vh] overflow-y-auto p-2">
          {results && (
            <>
              <Group title="Stories">
                {results.stories.slice(0, 5).map((s) => (
                  <Row key={s.id} onClick={() => go(`/story/${s.id}`)} title={s.title} hint={s.sourceName} />
                ))}
              </Group>
              <Group title="Topics & Entities">
                {results.topics.map((t) => (
                  <Row key={`t-${t.label}`} onClick={() => go(`/topic/${t.label.toLowerCase().replace(/\s+/g, "-")}`)} title={t.label} hint="Topic" />
                ))}
                {results.entities.map((e) => (
                  <Row key={`e-${e.label}`} onClick={() => go(`/topic/${e.label.toLowerCase().replace(/\s+/g, "-")}`)} title={e.label} hint="Entity" />
                ))}
              </Group>
              <Group title="Sources">
                {results.sources.map((s) => (
                  <Row key={s.name} onClick={() => go("/sources")} title={s.name} hint={s.category} />
                ))}
              </Group>
            </>
          )}
          {query.trim().length < 2 && (
            <Group title="Commands">
              {COMMANDS.map((c) => (
                <Row key={c.href} onClick={() => go(c.href)} title={c.label} />
              ))}
              <Row
                onClick={() => {
                  const next = !document.documentElement.classList.contains("dark");
                  document.documentElement.classList.toggle("dark", next);
                  try {
                    localStorage.setItem("pulse-theme", next ? "dark" : "light");
                  } catch {}
                  close();
                }}
                title="Switch Theme"
              />
              <Row
                onClick={async () => {
                  setBusy(true);
                  try {
                    await fetch("/api/admin/refresh", { method: "POST" });
                    close();
                    router.refresh();
                  } finally {
                    setBusy(false);
                  }
                }}
                title="Refresh feeds"
              />
              <Row
                onClick={async () => {
                  setBusy(true);
                  try {
                    await fetch("/api/brief?generate=1", { method: "POST" });
                    close();
                    router.push("/brief");
                    router.refresh();
                  } finally {
                    setBusy(false);
                  }
                }}
                title="Generate brief"
              />
            </Group>
          )}
          {busy && <div className="meta-mono px-3 py-2">Working…</div>}
          {results &&
            results.stories.length === 0 &&
            results.topics.length === 0 &&
            results.entities.length === 0 &&
            results.sources.length === 0 &&
            !busy && <div className="px-3 py-3 text-[13px] text-muted">No matches.</div>}
        </div>
      </div>
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-2">
      <div className="meta-label px-3 pb-1 pt-3">{title}</div>
      {children}
    </div>
  );
}

function Row({ title, hint, onClick }: { title: string; hint?: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-baseline justify-between gap-3 px-3 py-2 text-left text-[13.5px] text-secondary transition-colors duration-150 hover:bg-hover hover:text-foreground"
    >
      <span className="truncate">{title}</span>
      {hint && <span className="meta-mono flex-none text-[11px]">{hint}</span>}
    </button>
  );
}
