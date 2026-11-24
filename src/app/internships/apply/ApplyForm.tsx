"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  internshipId: string;
  email: string;
  initialName: string;
};

export default function ApplyForm({ internshipId, email, initialName }: Props) {
  const router = useRouter();
  const [fullName, setFullName] = useState(initialName);
  const [confirmed, setConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (fullName.trim().length < 2) {
      setError("Please enter your full name.");
      return;
    }

    if (!confirmed) {
      setError("Please confirm your name is spelled correctly.");
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch("/api/internships/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          internshipId,
          fullName: fullName.trim(),
          confirmName: true,
        }),
      });

      const data = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;

      if (!response.ok) {
        setError(data?.error || "Could not complete your application.");
        setSubmitting(false);
        return;
      }

      // Success: keep the button disabled while the panel loads.
      setDone(true);
      router.push(`/internships/${internshipId}`);
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 space-y-5">
      {error && (
        <p
          role="alert"
          className="break-words rounded-lg border border-red-500/40 p-3 text-sm text-red-700"
        >
          {error}
        </p>
      )}

      {done && (
        <p role="status" className="rounded-lg bg-surface p-3 text-sm">
          You are enrolled. Opening your internship panel...
        </p>
      )}

      <label className="block text-sm font-medium">
        Full name
        <input
          required
          maxLength={100}
          value={fullName}
          disabled={submitting}
          onChange={(e) => setFullName(e.target.value)}
          className="mt-2 w-full rounded-lg border border-line bg-transparent px-3 py-2.5 font-normal"
          placeholder="Name exactly as it should appear on your certificate"
        />
      </label>

      <p className="text-sm text-muted">
        We will send a confirmation to <strong>{email}</strong> and open your
        internship panel right away.
      </p>

      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          checked={confirmed}
          disabled={submitting}
          onChange={(e) => setConfirmed(e.target.checked)}
          className="mt-1 size-4"
        />
        <span>
          I confirm my name is spelled correctly. It will be printed on my
          certificate and appreciation letter and cannot be changed later.
        </span>
      </label>

      <button
        type="submit"
        disabled={submitting}
        className="btn disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitting ? "Enrolling..." : "Enroll in this internship"}
      </button>
    </form>
  );
}
