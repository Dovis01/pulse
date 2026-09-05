"use client";

import { useState } from "react";

export interface BriefContentProps {
  intro: string;
  sections: { label: string; text: string }[];
  watch: string[];
  introZh?: string;
  sectionsZh?: { label: string; text: string }[];
  watchZh?: string[];
}

/** /brief bilingual view (product spec §73: English + 中文). */
export function BriefBody(props: BriefContentProps) {
  const hasZh = Boolean(props.introZh);
  const [lang, setLang] = useState<"en" | "zh">("zh");

  const intro = lang === "en" ? props.intro : props.introZh ?? props.intro;
  const sections = lang === "en" ? props.sections : props.sectionsZh ?? props.sections;
  const watch = lang === "en" ? props.watch : props.watchZh ?? props.watch;

  return (
    <div>
      {hasZh && (
        <div className="mb-6 flex gap-2">
          {(["zh", "en"] as const).map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => setLang(l)}
              className={`meta-mono rounded-sm border px-2.5 py-1 text-[10px] uppercase tracking-[0.14em] transition-colors duration-150 ${
                lang === l
                  ? "border-border-strong text-foreground"
                  : "border-border text-muted hover:text-secondary"
              }`}
            >
              {l === "zh" ? "中文" : "EN"}
            </button>
          ))}
        </div>
      )}

      <p className="whitespace-pre-line text-[17px] leading-[1.8] text-foreground">{intro}</p>

      <div className="mt-10 space-y-9">
        {sections.map((section, i) => (
          <section key={`${section.label}-${i}`}>
            <div className="section-rule pb-2 pt-4">
              <h2 className="meta-label !text-secondary">{section.label}</h2>
            </div>
            <div className="mt-3 whitespace-pre-line text-[14.5px] leading-relaxed text-secondary">
              {section.text}
            </div>
          </section>
        ))}
      </div>

      {watch.length > 0 && (
        <section className="mt-10">
          <div className="section-rule pb-2 pt-4">
            <h2 className="meta-label !text-secondary">Watch today · 今日关注</h2>
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
    </div>
  );
}
