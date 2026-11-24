"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import DnaHelixCanvas from "./DnaHelixCanvas";

const DnaHelix3D = dynamic(() => import("./DnaHelix3D"), { ssr: false });

/** Centre-stage helix with floating glass cards describing BioCode Innovators. */
export default function HeroHelix() {
  const [mode, setMode] = useState<"3d" | "2d">("3d");
  const fail = useCallback(() => setMode("2d"), []);

  useEffect(() => {
    try {
      const c = document.createElement("canvas");
      const ok = !!(c.getContext("webgl2") || c.getContext("webgl"));
      const force = new URLSearchParams(window.location.search).has("nofallback");
      const weak = !force && (navigator.hardwareConcurrency || 8) <= 2;
      if (!ok || weak) setMode("2d");
    } catch {
      setMode("2d");
    }
  }, []);

  return (
    <div className="hx-stage">
      <div className="hx-halo" aria-hidden="true" />
      <div className="hx-rays" aria-hidden="true" />
      <div className="hx-mist hx-mist-a" aria-hidden="true" />
      <div className="hx-mist hx-mist-b" aria-hidden="true" />
      {mode === "3d" ? <DnaHelix3D onFail={fail} /> : <DnaHelixCanvas />}
      <div className="hx-grain" aria-hidden="true" />

      <aside className="hx-card hx-card-a" aria-label="Who we are">
        <span className="hx-card-icon" aria-hidden="true">
          <i /><i /><i /><i /><i />
        </span>
        <h3>Who we are</h3>
        <p>A research wing where biological science meets computational thinking.</p>
      </aside>

      <aside className="hx-card hx-card-b" aria-label="What we explore">
        <span className="hx-chips" aria-hidden="true"><b>Bio</b><b>AI</b><b>Data</b></span>
        <h3>What we explore</h3>
        <p>Bioinformatics, AI, data analytics and computational biology.</p>
      </aside>

      <aside className="hx-card hx-card-c" aria-label="How you take part">
        <h3>How you take part</h3>
        <p>Courses, research and student publications.</p>
        <Link href="/courses" className="hx-card-link">Start learning <span aria-hidden="true">↗</span></Link>
      </aside>

      <div className="hx-badge" aria-hidden="true">
        <svg viewBox="0 0 120 120">
          <defs>
            <path id="hx-ring" d="M60,60 m-44,0 a44,44 0 1,1 88,0 a44,44 0 1,1 -88,0" />
          </defs>
          <text>
            <textPath href="#hx-ring" textLength="272" lengthAdjust="spacing">BIOLOGY ✳ CODE ✳ DISCOVERY ✳ </textPath>
          </text>
          <path d="M60 46 L63 57 L74 60 L63 63 L60 74 L57 63 L46 60 L57 57 Z" />
        </svg>
      </div>

      <p className="hx-foot hx-foot-r"><span /> Less noise.<br />More discovery.</p>
    </div>
  );
}
