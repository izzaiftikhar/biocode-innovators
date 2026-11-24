"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function EnrolButton({ courseId }: { courseId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function enrol() {
    setBusy(true);
    setError("");

    try {
      const response = await fetch("/api/enrol", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseId }),
      });
      const result = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok) {
        setError(result?.error || "Could not enrol you. Please try again.");
        return;
      }

      router.refresh();
    } catch {
      setError("Could not connect. Please check your internet and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <button type="button" onClick={enrol} disabled={busy} className="btn mt-5 block w-full text-center disabled:opacity-60">
        {busy ? "Enrolling..." : "Enrol in this course"}
      </button>
      {error && (
        <p role="alert" className="mt-3 text-center text-sm text-red-700">{error}</p>
      )}
    </div>
  );
}
