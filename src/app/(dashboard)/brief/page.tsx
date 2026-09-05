import { GenerateBriefButton } from "@/components/brief/generate-brief-button";
import { BriefBody } from "@/components/brief/brief-body";
import { getBriefView } from "@/lib/queries";
import { relativeTime } from "@/lib/time/format";

export const dynamic = "force-dynamic";
export const metadata = { title: "Daily Brief" };

export default async function BriefPage() {
  const { brief, preview } = await getBriefView();
  const source = brief ?? preview;
  const intro = source?.intro ?? "No stories in the last 24 hours.";
  const sections = source?.sections ?? [];
  const watch = source?.watchList ?? [];
  const introZh = brief?.introZh ?? preview?.introZh;
  const sectionsZh = brief?.sectionsZh ?? preview?.sectionsZh;
  const watchZh = brief?.watchZh ?? preview?.watchZh;

  return (
    <div className="px-6 pb-16 md:px-10">
      <header className="pt-10 md:pt-14">
        <div className="meta-label">{brief?.briefDate ?? "Today"}</div>
        <h1 className="display-headline mt-3 text-foreground">The Daily Brief · 每日简报</h1>
        <div className="meta-mono mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11.5px]">
          <span>{brief?.storyCount ?? sections.length ?? 0} stories worth knowing</span>
          {brief && <span>· {brief.kind}</span>}
          {brief && <span>· generated {relativeTime(brief.generatedAt)}</span>}
          {brief?.model ? <span>· AI: {brief.model}</span> : <span>· rule-based edition</span>}
        </div>
      </header>

      <div className="mt-8 max-w-[52rem]">
        {sections.length > 0 || intro ? (
          <BriefBody
            intro={intro}
            sections={sections}
            watch={watch}
            introZh={introZh}
            sectionsZh={sectionsZh}
            watchZh={watchZh}
          />
        ) : (
          <p className="text-[15px] text-secondary">No stories in the last 24 hours.</p>
        )}

        <div className="mt-12 border-t border-border pt-5">
          <GenerateBriefButton />
          <p className="meta-mono mt-3 text-[11px] leading-relaxed">
            AI editions use the configured provider within budget; without a key the brief is composed
            from cluster metadata. Provenance is always stamped. 中文版由同一管线生成,可在设置中切换显示语言。
          </p>
        </div>
      </div>
    </div>
  );
}
