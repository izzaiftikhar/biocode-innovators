"use client";

import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import DnaHelix from "./DnaHelix";

const DnaHelix3D = dynamic(() => import("./DnaHelix3D"), { ssr: false });

/** Compact neon helix for the featured-course card. Falls back to the flat SVG if WebGL is unavailable. */
export default function FeatureHelix() {
  const [mode, setMode] = useState<"3d" | "svg">("3d");
  const fail = useCallback(() => setMode("svg"), []);

  useEffect(() => {
    try {
      const c = document.createElement("canvas");
      const ok = !!(c.getContext("webgl2") || c.getContext("webgl"));
      const force = new URLSearchParams(window.location.search).has("nofallback");
      const weak = !force && (navigator.hardwareConcurrency || 8) <= 2;
      if (!ok || weak) setMode("svg");
    } catch {
      setMode("svg");
    }
  }, []);

  return mode === "3d" ? <DnaHelix3D variant="card" className="hx-3d-card" onFail={fail} /> : <DnaHelix />;
}
