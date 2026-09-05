import { getTrendingSignals } from "@/lib/queries";

export const revalidate = 60; // ISR: instant navigation, fresh every minute
export const metadata = { title: "Trending" };

export default async function TrendingPage() {
  const signals = await getTrendingSignals();
  return (
    <div className="px-6 pb-16 md:px-10">
      <header className="pt-10 md:pt-14">
        <h1 className="display-headline text-foreground">Trending</h1>
        <p className="meta-mono mt-2 text-[11.5px]">
          Current coverage vs the trailing baseline. Trending is not importance.
        </p>
      </header>
      <ol className="mt-8 max-w-2xl">
        {signals.map((s, i) => (
          <li key={`${s.kind}-${s.label}`} className="story-row flex items-baseline gap-4">
            <span className="meta-mono w-7 text-[12px] tabular-nums text-muted">
              {String(i + 1).padStart(2, "0")}
            </span>
            <div className="min-w-0 flex-1">
              <div className="headline text-[17px] text-foreground">
                {s.label.replace(/\b\w/g, (c) => c.toUpperCase())}
              </div>
              <div className="meta-mono mt-0.5 text-[11px]">
                {s.current} mentions · baseline {s.baseline}
              </div>
            </div>
            <span className={`meta-mono text-[13px] tabular-nums ${s.changePct >= 0 ? "text-cat-markets" : "text-cat-security"}`}>
              {s.changePct >= 0 ? "↑" : "↓"} {Math.abs(s.changePct)}%
            </span>
          </li>
        ))}
        {signals.length === 0 && (
          <li className="story-row text-[13.5px] text-muted">Not enough data for a baseline yet.</li>
        )}
      </ol>
    </div>
  );
}
