"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";

export type Slide = {
  image: string;
  label: string;
  title: string;
  text?: string;
  href: string;
  cta?: string;
  external?: boolean;
};

// The ring needs enough cards to look full. If you pass fewer, slides repeat.
const MIN_CARDS = 8;
// Seconds for one full turn. Lower = faster.
const SECONDS_PER_TURN = 45;
// Space between neighbouring cards, as a fraction of card width.
const GAP_RATIO = 0.9;

export default function Coverflow({
  slides,
  ariaLabel,
}: {
  slides: Slide[];
  ariaLabel: string;
}) {
  const ringRef = useRef<HTMLDivElement>(null);

  const items: Slide[] =
    slides.length === 0
      ? []
      : Array.from(
          { length: Math.max(slides.length, MIN_CARDS) },
          (_, i) => slides[i % slides.length]
        );
  const count = items.length;

  useEffect(() => {
    const ring = ringRef.current;
    if (!ring || count === 0) return;

    const cards = Array.from(ring.children) as HTMLElement[];
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    const step = 360 / count;

    let radius = 0;
    let angle = 0;
    let paused = false;
    let last = performance.now();
    let raf = 0;

    // Put every card on a circle, sized from the real card width.
    const layout = () => {
      const w = cards[0].offsetWidth;
      radius = Math.round((w / 2 + (w * GAP_RATIO) / 2) / Math.tan(Math.PI / count));
      cards.forEach((card, i) => {
        card.style.transform = `rotateY(${i * step}deg) translateZ(${radius}px)`;
      });
    };

    // Rotate the ring and fade/blur cards that are further away.
    const draw = () => {
      ring.style.transform = `translateZ(${-radius}px) rotateY(${angle}deg)`;
      cards.forEach((card, i) => {
        const a = ((i * step + angle) * Math.PI) / 180;
        const depth = (Math.cos(a) + 1) / 2; // 1 = front, 0 = back
        card.style.opacity = (0.3 + 0.7 * depth).toFixed(2);
        card.style.filter = `blur(${((1 - depth) * 2).toFixed(1)}px)`;
        card.style.zIndex = String(Math.round(depth * 100));
      });
    };

    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      if (!paused) angle -= (360 / SECONDS_PER_TURN) * dt;
      draw();
      raf = requestAnimationFrame(tick);
    };

    layout();
    draw();
    if (!reduceMotion) raf = requestAnimationFrame(tick);

    const stage = ring.parentElement as HTMLElement;
    const pause = () => (paused = true);
    const resume = () => (paused = false);
    stage.addEventListener("mouseenter", pause);
    stage.addEventListener("mouseleave", resume);
    stage.addEventListener("focusin", pause);
    stage.addEventListener("focusout", resume);

    const onResize = () => {
      layout();
      draw();
    };
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      stage.removeEventListener("mouseenter", pause);
      stage.removeEventListener("mouseleave", resume);
      stage.removeEventListener("focusin", pause);
      stage.removeEventListener("focusout", resume);
    };
  }, [count]);

  if (count === 0) return null;

  return (
    <section className="bio-carousel w-full" aria-label={ariaLabel}>
      <div className="bio-carousel-stage">
        <div className="bio-carousel-ring" ref={ringRef}>
          {items.map((slide, index) => {
            const card = (
              <>
                <img
                  src={slide.image}
                  alt=""
                  draggable={false}
                  loading={index < 2 ? "eager" : "lazy"}
                  className="bio-carousel-image"
                />

                <div className="bio-carousel-content">
                  <p className="bio-carousel-label">{slide.label}</p>
                  <h3 className="bio-carousel-title">{slide.title}</h3>
                  {slide.text && (
                    <p className="bio-carousel-description">{slide.text}</p>
                  )}
                  <p className="bio-carousel-cta">
                    {slide.cta ?? "Explore"} →
                  </p>
                </div>
              </>
            );

            return (
              <div
                key={`${slide.title}-${index}`}
                className="bio-carousel-card-position"
              >
                {slide.external ? (
                  <a
                    href={slide.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bio-carousel-card"
                    aria-label={`${slide.title} — opens in a new tab`}
                  >
                    {card}
                  </a>
                ) : (
                  <Link href={slide.href} className="bio-carousel-card">
                    {card}
                  </Link>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <p className="bio-carousel-hint">
        Explore our research, learning and discoveries
      </p>

      <style jsx>{`
        .bio-carousel {
          --card-width: 260px;
          --card-height: 440px;
          position: relative;
          overflow: hidden;
          padding: 24px 0 12px;
          color: #14262b;
          background: radial-gradient(
            ellipse at 50% 45%,
            #ffffff 0%,
            #eef3f2 75%
          );
          border: 1px solid #dfe8e6;
          border-radius: 18px;
        }

        .bio-carousel-stage {
          position: relative;
          display: grid;
          place-items: center;
          height: 530px;
          perspective: 1200px;
          perspective-origin: 50% 42%;
          overflow: hidden;
        }

        .bio-carousel-ring {
          position: relative;
          width: var(--card-width);
          height: var(--card-height);
          transform-style: preserve-3d;
        }

        /* Position is set by JS: rotateY(angle) translateZ(radius).
           No backface-visibility rule, so cards at the back stay visible
           through the gaps, smaller and fainter, like in the reference. */
        .bio-carousel-card-position {
          position: absolute;
          inset: 0;
          width: var(--card-width);
          height: var(--card-height);
          transform-style: preserve-3d;
          will-change: transform, opacity;
        }

        .bio-carousel-card {
          display: flex;
          flex-direction: column;
          width: 100%;
          height: 100%;
          overflow: hidden;
          border: 1px solid #dfe8e6;
          border-radius: 18px;
          background: #ffffff;
          color: #14262b;
          text-decoration: none;
          box-shadow: 0 18px 40px rgba(20, 38, 43, 0.18);
          transition: border-color 200ms ease;
        }

        .bio-carousel-card:hover,
        .bio-carousel-card:focus-visible {
          border-color: #0e7490;
          outline: none;
        }

        .bio-carousel-image {
          display: block;
          width: 100%;
          height: 200px;
          flex-shrink: 0;
          object-fit: cover;
          background: #e3ecea;
          user-select: none;
        }

        .bio-carousel-content {
          display: flex;
          flex: 1;
          flex-direction: column;
          align-items: flex-start;
          padding: 16px;
        }

        .bio-carousel-label {
          margin: 0;
          color: #0e7490;
          font-size: 12px;
          font-weight: 600;
          letter-spacing: 0.04em;
        }

        .bio-carousel-title {
          display: -webkit-box;
          overflow: hidden;
          margin: 12px 0 0;
          color: #14262b;
          font-size: 20px;
          font-weight: 600;
          line-height: 1.35;
          -webkit-box-orient: vertical;
          -webkit-line-clamp: 2;
        }

        .bio-carousel-description {
          display: -webkit-box;
          overflow: hidden;
          margin: 10px 0 0;
          color: #4d6168;
          font-size: 14px;
          line-height: 1.5;
          -webkit-box-orient: vertical;
          -webkit-line-clamp: 3;
        }

        .bio-carousel-cta {
          margin: auto 0 0;
          padding-top: 10px;
          color: #0e7490;
          font-size: 14px;
          font-weight: 600;
        }

        .bio-carousel-hint {
          margin: 0;
          padding: 4px 12px 8px;
          color: #4d6168;
          font-size: 12px;
          text-align: center;
        }
      `}</style>
    </section>
  );
}
