"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function RetakeRequestForm({
  courseId,
}: {
  courseId: string;
}) {
  const router = useRouter();

  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setMessage("");
    setError("");

    const trimmedReason = reason.trim();

    if (trimmedReason.length < 10 || trimmedReason.length > 2000) {
      setError("Please enter an explanation between 10 and 2000 characters.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/quiz/retake-request", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          courseId,
          reason: trimmedReason,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || data.message || "Could not submit your request.");
        return;
      }

      setMessage(
        data.message || "Your retake request has been submitted for review."
      );
      setReason("");
      router.refresh();
    } catch {
      setError("A network error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="mt-6 rounded-lg border border-line p-6">
      <h3 className="text-lg font-semibold">Request a quiz retake</h3>

      <p className="mt-2 text-sm text-muted">
        Explain why you need another attempt. Your request will be reviewed by
        the BioCode admin team. Your previous result will remain محفوظ in your
        attempt history.
      </p>

      <form onSubmit={handleSubmit} className="mt-5 space-y-4">
        <div>
          <label
            htmlFor="retake-reason"
            className="mb-2 block text-sm font-medium"
          >
            Reason for requesting another attempt
          </label>

          <textarea
            id="retake-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Explain why you need another attempt..."
            rows={5}
            maxLength={2000}
            required
            disabled={loading}
            className="w-full rounded-lg border border-line bg-background p-3 text-sm outline-none focus:border-primary disabled:opacity-60"
          />

          <p className="mt-1 text-right text-xs text-muted">
            {reason.trim().length}/2000 characters (minimum 10)
          </p>
        </div>

        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}

        {message && (
          <p role="status" className="text-sm text-green-600">
            {message}
          </p>
        )}

        <button
          type="submit"
          disabled={loading || reason.trim().length < 10}
          className="btn disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "Submitting..." : "Submit retake request"}
        </button>
      </form>
    </section>
  );
}
