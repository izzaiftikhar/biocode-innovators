"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import PageHeader from "@/components/PageHeader";
import { createBrowserSupabase } from "@/lib/supabase/client";

const LINKS = [
  { key: "linkedin", name: "LinkedIn", url: "https://www.linkedin.com/company/biocode-innovators/" },
  { key: "instagram", name: "Instagram", url: "https://www.instagram.com/biocodeinnovators/" },
  { key: "youtube", name: "YouTube", url: "https://www.youtube.com/@BIOCODEINNOVATORS" },
] as const;

type Key = (typeof LINKS)[number]["key"];
const none: Record<Key, boolean> = { linkedin: false, instagram: false, youtube: false };

async function call(platform: Key, action: "start" | "confirm") {
  const res = await fetch("/api/follow/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ platform, action }),
  });
  const json = await res.json().catch(() => ({}));
  return res.ok && !!json.ok;
}

export default function FollowUs() {
  const [verified, setVerified] = useState<Record<Key, boolean>>(none);
  const opened = useRef<Partial<Record<Key, { left: boolean }>>>({});
  const confirming = useRef<Set<Key>>(new Set());

  const confirm = useCallback(async (key: Key) => {
    if (confirming.current.has(key)) return;
    confirming.current.add(key);
    try {
      if (await call(key, "confirm")) {
        setVerified((v) => ({ ...v, [key]: true }));
      }
    } catch {
    } finally {
      confirming.current.delete(key);
    }
  }, []);

  // Load saved progress; if a student opened a link and the page reloaded, finish the tick.
  useEffect(() => {
    async function load() {
      try {
        const supabase = createBrowserSupabase();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;
        const { data } = await supabase
          .from("social_follow")
          .select("*")
          .eq("user_id", user.id)
          .maybeSingle();
        if (!data) return;
        setVerified({
          linkedin: !!data.linkedin,
          instagram: !!data.instagram,
          youtube: !!data.youtube,
        });
        LINKS.forEach(({ key }) => {
          if (!data[key] && data[`${key}_opened_at`]) confirm(key);
        });
      } catch {}
    }
    load();
  }, [confirm]);

  // Tick turns blue when the student comes back from the social page.
  useEffect(() => {
    function markLeft() {
      (Object.keys(opened.current) as Key[]).forEach((k) => {
        const o = opened.current[k];
        if (o) o.left = true;
      });
    }

    function onReturn() {
      if (document.visibilityState !== "visible") return;
      (Object.keys(opened.current) as Key[]).forEach((k) => {
        const o = opened.current[k];
        if (!o || !o.left) return;
        delete opened.current[k];
        confirm(k);
      });
    }

    function onVisibility() {
      if (document.visibilityState === "hidden") markLeft();
      else onReturn();
    }

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("blur", markLeft);
    window.addEventListener("focus", onReturn);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("blur", markLeft);
      window.removeEventListener("focus", onReturn);
    };
  }, [confirm]);

  function onOpen(key: Key) {
    opened.current[key] = { left: false };
    call(key, "start").catch(() => {});
  }

  const allDone = LINKS.every((l) => verified[l.key]);

  return (
    <>
      <PageHeader
        title="One last step"
        intro="Follow BioCode Innovators on all three platforms to unlock your account."
      />
      <section className="container-page py-14">
        <div className="mx-auto max-w-md space-y-4 rounded-lg border border-line bg-bg p-6 shadow-sm sm:p-8">
          {LINKS.map((l) => (
            <div
              key={l.key}
              className="flex items-center justify-between gap-3 rounded-md border border-line p-3"
            >
              <div className="flex items-center gap-3">
                {verified[l.key] ? (
                  <span
                    className="flex h-6 w-6 items-center justify-center rounded-full bg-[#1D9BF0] text-white"
                    aria-label={`${l.name} followed`}
                  >
                    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M3 8.5l3.2 3L13 4.5" />
                    </svg>
                  </span>
                ) : (
                  <span className="h-6 w-6 rounded-full border-2 border-line" aria-hidden="true" />
                )}
                <span className="text-sm font-semibold">{l.name}</span>
              </div>

              {verified[l.key] ? (
                <span className="text-sm font-semibold text-success">Followed</span>
              ) : (
                <a
                  href={l.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => onOpen(l.key)}
                  className="text-sm font-semibold text-primary hover:underline"
                >
                  Follow on {l.name}
                </a>
              )}
            </div>
          ))}

          <p className="text-xs text-muted">
            Tap each button, follow us on that page, then come back here. The tick turns blue
            when you return.
          </p>

          <button
            className="btn w-full"
            disabled={!allDone}
            onClick={() => window.location.assign("/dashboard")}
          >
            Continue
          </button>
        </div>
      </section>
    </>
  );
}