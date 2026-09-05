"use client";

import { useEffect, useState } from "react";

/** Mobile sidebar drawer (product spec §64). Triggered by [data-drawer-open]. */
export function MobileDrawer({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (target.closest("[data-drawer-open]")) {
        event.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("click", onClick);
    return () => window.removeEventListener("click", onClick);
  }, []);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex fade-in lg:hidden" role="dialog" aria-label="Menu">
      <div className="flex-1 bg-black/40" onClick={() => setOpen(false)} role="presentation" />
      <div className="h-full border-l border-border bg-background">
        <div onClick={() => setOpen(false)}>{children}</div>
      </div>
    </div>
  );
}
