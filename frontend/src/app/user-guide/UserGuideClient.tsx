"use client";

import { useCallback, useEffect, useState } from "react";
import {
  userGuideSections,
  USER_GUIDE_META,
  type GuideBlock,
  type GuideSection
} from "@/content/userGuide";

function BlockView({ block }: { block: GuideBlock }) {
  if (block.type === "p") {
    return <p className="text-slate-300 leading-relaxed">{block.text}</p>;
  }
  if (block.type === "ul") {
    return (
      <ul className="list-disc pl-5 space-y-2 text-slate-300">
        {block.items.map((item, i) => (
          <li key={i} className="leading-relaxed">
            {item}
          </li>
        ))}
      </ul>
    );
  }
  return (
    <p className="rounded-lg border border-amber-800/60 bg-amber-950/25 px-3 py-2 text-sm text-amber-100/90">
      {block.text}
    </p>
  );
}

function SectionCard({
  section,
  index,
  onNavigate
}: {
  section: GuideSection;
  index: number;
  onNavigate: (id: string) => void;
}) {
  const prev = index > 0 ? userGuideSections[index - 1] : null;
  const next =
    index < userGuideSections.length - 1 ? userGuideSections[index + 1] : null;

  return (
    <article
      id={section.id}
      className="scroll-mt-24 rounded-xl border border-slate-800 bg-slate-900/50 p-5 md:p-6 space-y-4"
    >
      <h2 className="text-xl font-semibold text-white border-b border-slate-700 pb-2">
        {section.title}
      </h2>
      <div className="space-y-4">
        {section.blocks.map((b, i) => (
          <BlockView key={i} block={b} />
        ))}
      </div>
      <div className="flex flex-wrap gap-2 pt-4 border-t border-slate-800">
        {prev ? (
          <button
            type="button"
            onClick={() => onNavigate(prev.id)}
            className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white hover:bg-slate-700"
          >
            ← {prev.title}
          </button>
        ) : (
          <span />
        )}
        {next ? (
          <button
            type="button"
            onClick={() => onNavigate(next.id)}
            className="rounded-lg bg-brand px-3 py-2 text-sm font-medium text-white hover:bg-brand/90 ml-auto"
          >
            {next.title} →
          </button>
        ) : null}
      </div>
    </article>
  );
}

export function UserGuideClient() {
  const [openToc, setOpenToc] = useState(false);

  const scrollToId = useCallback((id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      history.replaceState(null, "", `#${id}`);
    }
    setOpenToc(false);
  }, []);

  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (hash && userGuideSections.some((s) => s.id === hash)) {
      requestAnimationFrame(() => {
        document.getElementById(hash)?.scrollIntoView({
          behavior: "auto",
          block: "start"
        });
      });
    }
  }, []);

  return (
    <div className="flex flex-col lg:flex-row gap-6 lg:gap-8 pb-16">
      {/* Mobile TOC toggle */}
      <div className="lg:hidden">
        <button
          type="button"
          onClick={() => setOpenToc((o) => !o)}
          className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-medium text-white"
        >
          {openToc ? "Hide" : "Show"} table of contents
        </button>
        {openToc && (
          <nav
            className="mt-2 max-h-[40vh] overflow-y-auto rounded-lg border border-slate-800 bg-slate-900/90 p-2"
            aria-label="Table of contents"
          >
            <ol className="space-y-0.5 text-sm">
              {userGuideSections.map((s, i) => (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => scrollToId(s.id)}
                    className="w-full text-left rounded px-2 py-1.5 text-slate-300 hover:bg-slate-800 hover:text-white"
                  >
                    <span className="text-slate-500 mr-2">{i + 1}.</span>
                    {s.title}
                  </button>
                </li>
              ))}
            </ol>
          </nav>
        )}
      </div>

      {/* Desktop sidebar TOC */}
      <aside className="hidden lg:block w-64 shrink-0">
        <div className="sticky top-4 rounded-xl border border-slate-800 bg-slate-900/70 p-3 max-h-[calc(100vh-6rem)] overflow-y-auto">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 px-2 mb-2">
            Contents
          </p>
          <nav aria-label="Table of contents">
            <ol className="space-y-0.5 text-sm">
              {userGuideSections.map((s, i) => (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => scrollToId(s.id)}
                    className="w-full text-left rounded-lg px-2 py-1.5 text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
                  >
                    <span className="text-slate-500 mr-1.5 tabular-nums">
                      {i + 1}.
                    </span>
                    {s.title}
                  </button>
                </li>
              ))}
            </ol>
          </nav>
        </div>
      </aside>

      <div className="flex-1 min-w-0 space-y-6">
        <header className="space-y-2">
          <h1 className="text-3xl font-semibold text-white">
            Value Navigator — user guide
          </h1>
          <p className="text-slate-400 text-sm">
            Interactive version of{" "}
            <span className="font-mono text-slate-300">
              {USER_GUIDE_META.sourceLabel}
            </span>
            . Use the contents menu or the buttons at the bottom of each
            section to move through the topics.
          </p>
        </header>

        <div className="space-y-8">
          {userGuideSections.map((section, index) => (
            <SectionCard
              key={section.id}
              section={section}
              index={index}
              onNavigate={scrollToId}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
