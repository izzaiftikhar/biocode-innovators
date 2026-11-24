
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function RetakeQuizButton({
  courseId,
}: {
  courseId: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function startRetake() {
    if (loading) return;

    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/quiz/session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ courseId }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Could not start your retake.");
        return;
      }

      router.refresh();
    } catch {
      setError("A network error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-6">
      {error && (
        <p role="alert" className="mb-3 text-sm text-red-600">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={() => void startRetake()}
        disabled={loading}
        className="btn disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? "Starting your retake..." : "Retake Quiz"}
      </button>
    </div>
  );
}
