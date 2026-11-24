"use client";

import { useId, useMemo, useState } from "react";
import Link from "next/link";
import { FAQ_CATEGORIES, type Faq } from "@/data/faqs";

export default function FaqList({ faqs }: { faqs: Faq[] }) {
  const baseId = useId();
  const [category, setCategory] = useState<string>("All");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<Set<string>>(new Set());

  const counts = useMemo(() => {
    const map = new Map<string, number>();
    faqs.forEach((f) => map.set(f.category, (map.get(f.category) ?? 0) + 1));
    return map;
  }, [faqs]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return faqs.filter(
      (f) =>
        (category === "All" || f.category === category) &&
        (!q || f.question.toLowerCase().includes(q) || f.answer.toLowerCase().includes(q)),
    );
  }, [faqs, category, query]);

  const allOpen = visible.length > 0 && visible.every((f) => open.has(f.id));

  function toggle(id: string) {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setOpen((prev) => {
      const next = new Set(prev);
      visible.forEach((f) => (allOpen ? next.delete(f.id) : next.add(f.id)));
      return next;
    });
  }

  const tabs = ["All", ...FAQ_CATEGORIES];

  return (
    /* grid-cols-1 = minmax(0,1fr): stops the topic chips from stretching
       the column (and the whole page) wider than the screen on mobile */
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[17rem_minmax(0,1fr)] lg:gap-12">
      {/* Sidebar: search + topics */}
      <aside className="min-w-0 lg:sticky lg:top-24 lg:self-start">
        <div className="relative">
          <label htmlFor={`${baseId}-search`} className="sr-only">Search questions</label>
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input
            id={`${baseId}-search`}
            type="search"
            className="field !rounded-xl !py-3 !pl-10 shadow-sm"
            placeholder="Search questions…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        <p className="mb-3 mt-7 hidden text-xs font-semibold uppercase tracking-widest text-muted lg:block">Topics</p>
        <div
          role="group"
          aria-label="Filter by topic"
          className="-mx-5 mt-5 flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:-mx-8 sm:px-8 lg:mx-0 lg:mt-0 lg:flex-col lg:gap-1 lg:overflow-visible lg:px-0 lg:pb-0"
        >
          {tabs.map((c) => {
            const active = category === c;
            const count = c === "All" ? faqs.length : counts.get(c) ?? 0;
            return (
              <button
                key={c}
                type="button"
                aria-pressed={active}
                onClick={() => setCategory(c)}
                className={`flex shrink-0 items-center justify-between gap-3 whitespace-nowrap rounded-full border px-4 py-2 text-sm font-medium transition-colors lg:rounded-lg lg:border-transparent lg:py-2.5 ${
                  active
                    ? "border-primary bg-primary text-white lg:bg-primary/10 lg:text-primary"
                    : "border-line bg-bg text-ink/75 hover:border-primary/40 hover:text-primary lg:hover:bg-surface"
                }`}
              >
                <span>{c}</span>
                <span className={`rounded-full px-2 py-0.5 text-xs ${active ? "bg-white/20 lg:bg-primary/15" : "bg-surface text-muted"}`}>{count}</span>
              </button>
            );
          })}
        </div>
      </aside>

      {/* Questions */}
      <div className="min-w-0">
        <div className="mb-4 flex items-center justify-between gap-4">
          <p className="text-sm text-muted" role="status" aria-live="polite">
            {visible.length} {visible.length === 1 ? "question" : "questions"}
            {category !== "All" && <> in <span className="font-semibold text-ink">{category}</span></>}
          </p>
          {visible.length > 1 && (
            <button type="button" onClick={toggleAll} className="shrink-0 text-sm font-semibold text-primary underline-offset-4 hover:underline">
              {allOpen ? "Collapse all" : "Expand all"}
            </button>
          )}
        </div>

        {visible.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line bg-surface/60 p-10 text-center">
            <p className="font-heading text-lg font-semibold">No matching questions</p>
            <p className="mx-auto mt-2 max-w-sm text-muted">Try a different word or topic, or ask our team directly.</p>
            <div className="mt-5 flex justify-center gap-3">
              <button type="button" className="btn-outline" onClick={() => { setQuery(""); setCategory("All"); }}>Clear filters</button>
              <Link href="/contact" className="btn">Contact us</Link>
            </div>
          </div>
        ) : (
          <ul className="space-y-3">
            {visible.map((f) => {
              const isOpen = open.has(f.id);
              const panelId = `${baseId}-${f.id}-panel`;
              const buttonId = `${baseId}-${f.id}-button`;
              return (
                <li
                  key={f.id}
                  className={`overflow-hidden rounded-xl border bg-bg transition-all duration-200 ${
                    isOpen ? "border-primary/40 shadow-md ring-1 ring-primary/10" : "border-line hover:border-primary/30 hover:shadow-sm"
                  }`}
                >
                  <h3 className="!text-base !tracking-normal">
                    <button
                      id={buttonId}
                      type="button"
                      aria-expanded={isOpen}
                      aria-controls={panelId}
                      onClick={() => toggle(f.id)}
                      className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
                    >
                      <span className="min-w-0">
                        {category === "All" && (
                          <span className="mb-1 block text-[11px] font-semibold uppercase tracking-widest text-primary">{f.category}</span>
                        )}
                        <span className="block font-heading text-[15px] font-medium leading-snug sm:text-base">{f.question}</span>
                      </span>
                      <span
                        aria-hidden="true"
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-all duration-200 ${
                          isOpen ? "rotate-180 bg-primary text-white" : "bg-surface text-primary"
                        }`}
                      >
                        <svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M5 8l5 5 5-5" />
                        </svg>
                      </span>
                    </button>
                  </h3>
                  <div
                    id={panelId}
                    role="region"
                    aria-labelledby={buttonId}
                    className={`grid transition-[grid-template-rows,visibility] duration-300 ease-out ${
                      isOpen ? "visible grid-rows-[1fr]" : "invisible grid-rows-[0fr]"
                    }`}
                  >
                    <div className="overflow-hidden">
                      <div className="border-t border-line/70 px-5 pb-5 pt-4">
                        <p className="break-words leading-relaxed text-ink/80">{f.answer}</p>
                        {f.link && (
                          <Link href={f.link.href} className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-4 py-1.5 text-sm font-semibold text-primary transition-colors hover:bg-primary hover:text-white">
                            {f.link.label} <span aria-hidden="true">→</span>
                          </Link>
                        )}
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
