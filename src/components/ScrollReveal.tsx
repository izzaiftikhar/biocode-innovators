"use client";

import { useEffect, useRef } from "react";

/** Frontend-only motion: reveals content as it scrolls into view + a top progress bar. */
const SELECTOR = [
  "#main section:not(.biocode-hero) h2",
  "#main section:not(.biocode-hero) .section-kicker",
  "#main section:not(.biocode-hero) .section-heading > p",
  ".pathway-card", ".update-card", ".feature-course", ".pub-row", ".count-item",
  ".glow-card", ".community-cta", "#main article", "#main .card",
].join(",");

export default function ScrollReveal() {
  const bar = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const main = document.getElementById("main");
    if (!main) return;

    const onScroll = () => {
      const h = document.documentElement.scrollHeight - window.innerHeight;
      if (bar.current) bar.current.style.transform = `scaleX(${h > 0 ? Math.min(1, window.scrollY / h) : 0})`;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    if (reduce) return () => window.removeEventListener("scroll", onScroll);

    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => {
        if (e.isIntersecting) { e.target.classList.add("sr-in"); io.unobserve(e.target); }
      }),
      { threshold: 0.12, rootMargin: "0px 0px -6% 0px" }
    );

    const seen = new WeakSet<Element>();
    const scan = () => {
      main.querySelectorAll(SELECTOR).forEach((el) => {
        if (seen.has(el) || el.closest(".biocode-hero")) return;
        seen.add(el);
        const sibs = el.parentElement ? Array.from(el.parentElement.children).indexOf(el) : 0;
        (el as HTMLElement).style.setProperty("--sr-delay", `${Math.min(sibs, 5) * 90}ms`);
        el.classList.add("sr");
        io.observe(el);
      });
    };
    // wait until React has finished hydrating so we never touch server-rendered class names early
    let t: ReturnType<typeof setTimeout>;
    let mo: MutationObserver | undefined;
    const boot = setTimeout(() => {
      scan();
      mo = new MutationObserver(() => { clearTimeout(t); t = setTimeout(scan, 80); });
      mo.observe(main, { childList: true, subtree: true });
    }, 1600);

    return () => { window.removeEventListener("scroll", onScroll); io.disconnect(); mo?.disconnect(); clearTimeout(t); clearTimeout(boot); };
  }, []);

  return <div ref={bar} className="sr-bar" aria-hidden="true" />;
}
