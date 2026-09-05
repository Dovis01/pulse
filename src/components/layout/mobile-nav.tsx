"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** Mobile bottom navigation (product spec §64): not a shrunken desktop. */
const ITEMS = [
  { href: "/", label: "Today" },
  { href: "/latest", label: "Latest" },
  { href: "/for-you", label: "For You" },
  { href: "command", label: "Search" },
];

export function MobileNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/90 backdrop-blur-sm lg:hidden">
      <div className="grid grid-cols-5">
        {ITEMS.map((item) =>
          item.href === "command" ? (
            <button
              key={item.label}
              type="button"
              data-command-open
              className="py-3 text-center text-[11px] text-secondary"
            >
              {item.label}
            </button>
          ) : (
            <Link
              key={item.href}
              href={item.href}
              className={`py-3 text-center text-[11px] transition-colors duration-150 ${
                pathname === item.href ? "text-foreground" : "text-secondary"
              }`}
            >
              {item.label}
            </Link>
          ),
        )}
        <button
          type="button"
          data-drawer-open
          className="py-3 text-center text-[11px] text-secondary"
        >
          Menu
        </button>
      </div>
    </nav>
  );
}
