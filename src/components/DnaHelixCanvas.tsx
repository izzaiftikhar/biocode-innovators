"use client";

import { useEffect, useRef } from "react";

/**
 * Neon double helix (matches the reference video): thin glowing cyan strands,
 * luminous base-pair rungs, additive bloom, drifting particles, slow endless rotation.
 * Palette only: navy #0B1F4D, teal #087F8C, cyan #43DDE5 / #72EAF0, white.
 */

type Props = { className?: string; expanded?: boolean };

export default function DnaHelixCanvas({ className = "" }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const glowA = document.createElement("canvas");
    const glowB = document.createElement("canvas");
    const ga = glowA.getContext("2d")!;
    const gb = glowB.getContext("2d")!;

    let W = 0;
    let H = 0;
    const resize = () => {
      const r = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = r.width;
      H = r.height;
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      glowA.width = Math.max(8, Math.round(W / 6));
      glowA.height = Math.max(8, Math.round(H / 6));
      glowB.width = Math.max(8, Math.round(W / 14));
      glowB.height = Math.max(8, Math.round(H / 14));
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const particles = Array.from({ length: 90 }, () => ({
      x: Math.random(),
      y: Math.random(),
      s: 0.5 + Math.random() * 1.8,
      v: 0.006 + Math.random() * 0.03,
      p: Math.random() * 6.28,
      dx: (Math.random() - 0.5) * 0.01,
      big: Math.random() < 0.12,
    }));

    let mx = 0;
    let tiltMouse = 0;
    const onMove = (e: PointerEvent) => {
      mx = (e.clientX / window.innerWidth) * 2 - 1;
    };
    window.addEventListener("pointermove", onMove, { passive: true });

    const TURNS = 3.1;
    const GROOVE = Math.PI * 0.92;
    const N = 220;
    let rot = 0.6;
    let last = 0;

    const draw = (time: number) => {
      const t = time / 1000;
      const dt = last ? Math.min((time - last) / 1000, 0.05) : 0;
      last = time;
      if (!reduce) rot += dt * 0.55;
      tiltMouse += (mx * 0.06 - tiltMouse) * Math.min(1, dt * 2);

      ctx.globalCompositeOperation = "source-over";
      ctx.clearRect(0, 0, W, H);

      const cx = W / 2;
      const span = H * 1.25;
      const R = Math.min(W * 0.19, 108);
      const F = 5.5 * R;
      const tilt = -0.2 + tiltMouse;
      const w0 = Math.max(1.8, R * 0.04);

      ctx.globalCompositeOperation = "lighter";

      // drifting particles
      for (const p of particles) {
        const py = (((p.y - (reduce ? 0 : t * p.v)) % 1) + 1) % 1;
        const px = (((p.x + (reduce ? 0 : Math.sin(t * 0.3 + p.p) * p.dx)) % 1) + 1) % 1;
        const a = 0.15 + 0.7 * Math.abs(Math.sin(t * 0.8 + p.p));
        const rad = p.big ? p.s * 2.6 : p.s;
        if (p.big) {
          const g = ctx.createRadialGradient(px * W, py * H, 0, px * W, py * H, rad * 3);
          g.addColorStop(0, `rgba(114,234,240,${a * 0.35})`);
          g.addColorStop(1, "rgba(114,234,240,0)");
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(px * W, py * H, rad * 3, 0, 6.283);
          ctx.fill();
        }
        ctx.fillStyle = `rgba(200,250,252,${a * 0.8})`;
        ctx.beginPath();
        ctx.arc(px * W, py * H, rad * 0.7, 0, 6.283);
        ctx.fill();
      }

      const proj = (x: number, y: number, z: number) => {
        const xr = x * Math.cos(tilt) - y * Math.sin(tilt);
        const yr = x * Math.sin(tilt) + y * Math.cos(tilt);
        const k = F / (F - z);
        return { sx: cx + xr * k, sy: H / 2 + yr * k, k, d: (z / R + 1) / 2 };
      };

      type P = ReturnType<typeof proj>;
      const strands: P[][] = [[], []];
      for (let s = 0; s < 2; s++) {
        for (let i = 0; i <= N; i++) {
          const u = i / N;
          const y = (u - 0.5) * span;
          const a = u * TURNS * Math.PI * 2 + rot + (s ? GROOVE : 0);
          strands[s].push(proj(R * Math.cos(a), y, R * Math.sin(a)));
        }
      }

      type Item = { z: number; run: () => void };
      const items: Item[] = [];

      for (let s = 0; s < 2; s++) {
        const pts = strands[s];
        for (let i = 1; i < pts.length; i++) {
          const a = pts[i - 1];
          const b = pts[i];
          const d = (a.d + b.d) / 2;
          const k = (a.k + b.k) / 2;
          items.push({
            z: d,
            run: () => {
              const al = 0.18 + 0.82 * d * d;
              const w = w0 * k * (0.55 + 0.75 * d);
              ctx.lineCap = "round";
              ctx.strokeStyle = `rgba(8,127,140,${al * 0.22})`;
              ctx.lineWidth = w * 3.6;
              ctx.beginPath(); ctx.moveTo(a.sx, a.sy); ctx.lineTo(b.sx, b.sy); ctx.stroke();
              ctx.strokeStyle = `rgba(67,221,229,${al * 0.75})`;
              ctx.lineWidth = w * 1.5;
              ctx.beginPath(); ctx.moveTo(a.sx, a.sy); ctx.lineTo(b.sx, b.sy); ctx.stroke();
              ctx.strokeStyle = `rgba(224,253,254,${al})`;
              ctx.lineWidth = Math.max(0.7, w * 0.42);
              ctx.beginPath(); ctx.moveTo(a.sx, a.sy); ctx.lineTo(b.sx, b.sy); ctx.stroke();
            },
          });
        }
      }

      const rungs = Math.round(TURNS * 10);
      for (let j = 0; j <= rungs; j++) {
        const i = Math.round(((j + 0.5) / (rungs + 1)) * N);
        const a = strands[0][i];
        const b = strands[1][i];
        const d = (a.d + b.d) / 2;
        items.push({
          z: d - 0.02,
          run: () => {
            const al = 0.12 + 0.8 * d;
            const mxp = (a.sx + b.sx) / 2;
            const myp = (a.sy + b.sy) / 2;
            const gap = 0.08;
            const gx = (b.sx - a.sx) * gap;
            const gy = (b.sy - a.sy) * gap;
            const w = w0 * ((a.k + b.k) / 2);
            ctx.lineCap = "round";
            for (const [x1, y1, x2, y2, dd] of [
              [a.sx, a.sy, mxp - gx, myp - gy, a.d],
              [mxp + gx, myp + gy, b.sx, b.sy, b.d],
            ] as number[][]) {
              const g = ctx.createLinearGradient(x1, y1, x2, y2);
              g.addColorStop(0, `rgba(67,221,229,${al * (0.4 + 0.6 * dd)})`);
              g.addColorStop(1, `rgba(200,250,252,${al * 0.9})`);
              ctx.strokeStyle = g;
              ctx.lineWidth = w * 0.7;
              ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
            }
            ctx.fillStyle = `rgba(255,255,255,${al})`;
            ctx.beginPath(); ctx.arc(mxp, myp, Math.max(0.8, w * 0.28), 0, 6.283); ctx.fill();
            for (const q of [a, b]) {
              ctx.fillStyle = `rgba(114,234,240,${al * 0.9})`;
              ctx.beginPath(); ctx.arc(q.sx, q.sy, w * 0.9, 0, 6.283); ctx.fill();
            }
          },
        });
      }

      items.sort((p, q) => p.z - q.z);
      for (const it of items) it.run();

      // two-level bloom
      for (const [src, g, alpha] of [
        [glowA, ga, 0.28],
        [glowB, gb, 0.4],
      ] as [HTMLCanvasElement, CanvasRenderingContext2D, number][]) {
        g.clearRect(0, 0, src.width, src.height);
        g.drawImage(canvas, 0, 0, src.width, src.height);
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = alpha;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(src, 0, 0, W, H);
        ctx.restore();
      }
    };

    let raf = 0;
    let running = false;
    let visible = true;
    const loop = (now: number) => {
      draw(now);
      raf = requestAnimationFrame(loop);
    };
    const start = () => {
      if (running || reduce) return;
      running = true;
      raf = requestAnimationFrame(loop);
    };
    const stop = () => {
      running = false;
      cancelAnimationFrame(raf);
    };

    draw(0);
    const io = new IntersectionObserver(
      ([e]) => {
        visible = e.isIntersecting;
        visible && !document.hidden ? start() : stop();
      },
      { threshold: 0.02 }
    );
    io.observe(canvas);
    const onVis = () => (document.hidden || !visible ? stop() : start());
    document.addEventListener("visibilitychange", onVis);

    return () => {
      stop();
      io.disconnect();
      ro.disconnect();
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  return <canvas ref={ref} className={`hx-canvas ${className}`} role="img" aria-label="Rotating glowing DNA double helix" />;
}
