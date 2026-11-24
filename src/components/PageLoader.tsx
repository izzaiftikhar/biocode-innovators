"use client";
import { useEffect, useState } from "react";
import Wave from "@/components/Wave";

/** Full-screen loader shown only while the site first loads, then fades away. */
export default function PageLoader() {
  const [phase, setPhase] = useState<"show" | "fade" | "gone">("show");

  useEffect(() => {
    const started = Date.now();
    const finish = () => {
      // keep it visible for at least ~0.6s so it never just flashes
      const wait = Math.max(0, 600 - (Date.now() - started));
      window.setTimeout(() => {
        setPhase("fade");
        window.setTimeout(() => setPhase("gone"), 350);
      }, wait);
    };
    if (document.readyState === "complete") finish();
    else window.addEventListener("load", finish, { once: true });
    return () => window.removeEventListener("load", finish);
  }, []);

  if (phase === "gone") return null;
  return (
    <div
      role="status" aria-live="polite"
      className={`pageloader-failsafe fixed inset-0 z-[100] flex flex-col items-center justify-center gap-4 bg-bg transition-opacity duration-300 ${phase === "fade" ? "opacity-0" : "opacity-100"}`}
    >
      <Wave size={64} />
      <p className="text-sm font-semibold uppercase tracking-widest text-muted">Loading</p>
    </div>
  );
}
