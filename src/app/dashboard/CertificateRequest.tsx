"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase/client";

export default function CertificateRequest({
  courseId,
  initialName,
}: {
  courseId: string;
  initialName: string;
}) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function request() {
    const finalName = name.trim();
    setError("");

    if (!finalName) {
      setError("Enter your full name.");
      return;
    }
    if (!confirmed) {
      setError("Please confirm the spelling of your name.");
      return;
    }

    setBusy(true);

    try {
      // If the student corrected their name, save it to their profile first.
      if (finalName !== initialName.trim()) {
        const supabase = createBrowserSupabase();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Please sign in again.");

        const { error: updateError } = await supabase
          .from("profiles").update({ full_name: finalName }).eq("id", user.id);
        if (updateError) throw new Error("Could not update your name. Please try again.");
      }

      const response = await fetch("/api/certificates/issue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseId, confirmName: true, confirmedName: finalName }),
      });
      const result = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok) {
        setError(result?.error || "Could not issue your certificate.");
        return;
      }

      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-4 rounded-lg bg-surface p-4">
      <p className="font-semibold">Get your certificate</p>
      <p className="mt-1 text-sm text-muted">
        Your name will be printed exactly as written below. Check the spelling
        carefully, because it cannot be changed without admin help.
      </p>

      <label className="mt-4 block text-sm font-semibold" htmlFor={`cert-name-${courseId}`}>
        Name on certificate
      </label>
      <input
        id={`cert-name-${courseId}`}
        value={name}
        onChange={(event) => setName(event.target.value)}
        maxLength={100}
        className="mt-2 w-full rounded-xl border border-line bg-white px-3.5 py-3 outline-none focus:border-[#0e7490]"
      />

      <label className="mt-4 flex items-start gap-3 text-sm">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(event) => setConfirmed(event.target.checked)}
          className="mt-1"
        />
        <span>I confirm my name above is spelled correctly.</span>
      </label>

      {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}

      <button type="button" onClick={request} disabled={busy} className="btn mt-4 disabled:opacity-60">
        {busy ? "Generating certificate..." : "Generate my certificate"}
      </button>
    </div>
  );
}
