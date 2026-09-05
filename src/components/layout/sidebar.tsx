"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TODAY = [
  { href: "/", label: "Today" },
  { href: "/latest", label: "Latest" },
  { href: "/for-you", label: "For You" },
  { href: "/breaking", label: "Breaking" },
  { href: "/trending", label: "Trending" },
];

const TOPICS = [
  { href: "/topic/ai", label: "AI" },
  { href: "/topic/technology", label: "Technology" },
  { href: "/topic/open-source", label: "Open Source" },
  { href: "/topic/markets", label: "Markets" },
  { href: "/topic/business", label: "Business" },
  { href: "/topic/world", label: "World" },
  { href: "/topic/science", label: "Science" },
  { href: "/topic/cybersecurity", label: "Cybersecurity" },
];

const INTELLIGENCE = [
  { href: "/brief", label: "Daily Brief" },
  { href: "/topics", label: "Topics" },
  { href: "/sources", label: "Sources" },
  { href: "/timeline", label: "Timeline" },
  { href: "/saved", label: "Saved" },
];

const SYSTEM = [{ href: "/settings", label: "Settings" }];

function NavLink({ href, label }: { href: string; label: string }) {
  const pathname = usePathname();
  const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
  return (
    <Link
      href={href}
      className={`block py-[5px] text-[13.5px] transition-colors duration-150 ${
        active ? "text-foreground" : "text-secondary hover:text-foreground"
      }`}
    >
      {label}
    </Link>
  );
}

function NavGroup({ title, links }: { title: string; links: { href: string; label: string }[] }) {
  return (
    <div className="mb-7">
      <div className="meta-label mb-2">{title}</div>
      <nav>
        {links.map((l) => (
          <NavLink key={l.href} {...l} />
        ))}
      </nav>
    </div>
  );
}

export function Sidebar({ lastSync, live }: { lastSync?: string; live: boolean }) {
  return (
    <aside className="flex h-full w-[220px] flex-col overflow-y-auto px-6 pb-6 pt-7">
      <Link href="/" className="mb-9 block">
        <div className="headline text-[19px] tracking-tight text-foreground">
          {process.env.NEXT_PUBLIC_SITE_NAME ?? "Pulse"} <span className="text-muted">/</span>
        </div>
        <div className="meta-mono mt-1 text-[10.5px] uppercase tracking-[0.14em]">
          Global Intelligence
        </div>
      </Link>

      <div className="flex-1">
        <NavGroup title="Overview" links={TODAY} />
        <NavGroup title="Topics" links={TOPICS} />
        <NavGroup title="Intelligence" links={INTELLIGENCE} />
        <NavGroup title="System" links={SYSTEM} />
      </div>

      <div className="meta-mono space-y-1 border-t border-border pt-4 text-[11px]">
        <div>Last sync {lastSync ?? "—"}</div>
        <div className="flex items-center gap-1.5">
          <span
            className={`cat-dot ${live ? "bg-cat-markets" : "bg-muted"}`}
            aria-hidden
          />
          <span>{live ? "Live" : "Idle"}</span>
        </div>
      </div>
    </aside>
  );
}
