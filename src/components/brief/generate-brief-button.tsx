"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/** Regenerates the Daily Brief via the server route (budget-guarded). */
export function GenerateBriefButton() {
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await fetch("/api/brief?generate=1", { method: "POST" });
          router.refresh();
        } finally {
          setBusy(false);
        }
      }}
      className="meta-mono rounded-sm border border-border px-3 py-1.5 text-[11px] uppercase tracking-[0.12em] text-secondary transition-colors duration-150 hover:border-border-strong hover:text-foreground disabled:opacity-50"
    >
      {busy ? "Generating…" : "Regenerate brief"}
    </button>
  );
}
