import { GenerateBriefButton } from "@/components/brief/generate-brief-button";
import { getBriefView } from "@/lib/queries";
import { relativeTime } from "@/lib/time/format";

export const dynamic = "force-dynamic";
export const metadata = { title: "Daily Brief" };

export default async function BriefPage() {
  const { brief, preview } = await getBriefView();
  const intro = brief?.intro ?? preview?.intro ?? "No stories in the last 24 hours.";
  const sections = brief?.sections ?? preview?.sections ?? [];
  const watch = brief?.watchList ?? preview?.watchList ?? [];

  return (
    <div className="px-6 pb-16 md:px-10">
      <header className="pt-10 md:pt-14">
        <div className="meta-label">{brief?.briefDate ?? "Today"}</div>
        <h1 className="display-headline mt-3 text-foreground">The Daily Brief</h1>
        <div className="meta-mono mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11.5px]">
          <span>{brief?.storyCount ?? preview?.sections.length ?? 0} stories worth knowing</span>
          {brief && <span>· {brief.kind}</span>}
          {brief && <span>· generated {relativeTime(brief.generatedAt)}</span>}
          {brief?.model ? <span>· AI: {brief.model}</span> : <span>· rule-based edition</span>}
        </div>
      </header>

      <div className="mt-8 max-w-[52rem]">
        <p className="text-[17px] leading-[1.8] text-foreground">{intro}</p>

        <div className="mt-10 space-y-9">
          {sections.map((s, i) => (
            <section key={`${s.label}-${i}`}>
              <div className="section-rule pb-2 pt-4">
                <h2 className="meta-label !text-secondary">{s.label}</h2>
              </div>
              <p className="mt-3 text-[14.5px] leading-relaxed text-secondary">{s.text}</p>
            </section>
          ))}
        </div>

        {watch.length > 0 && (
          <section className="mt-10">
            <div className="section-rule pb-2 pt-4">
              <h2 className="meta-label !text-secondary">Watch today</h2>
            </div>
            <ul className="mt-3 space-y-1.5">
              {watch.map((w) => (
                <li key={w} className="text-[14px] text-secondary">
                  <span className="mr-2 text-muted">•</span>
                  {w}
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className="mt-12 border-t border-border pt-5">
          <GenerateBriefButton />
          <p className="meta-mono mt-3 text-[11px] leading-relaxed">
            AI editions use the configured provider within budget; without a key the brief is composed
            from cluster metadata. Provenance is always stamped.
          </p>
        </div>
      </div>
    </div>
  );
}
