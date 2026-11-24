"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function InternshipPaymentForm({
  enrollmentId,
  defaultName,
}: {
  enrollmentId: string;
  defaultName: string;
}) {
  const router = useRouter();
  const [name, setName] = useState(defaultName);
  const [confirmed, setConfirmed] = useState(false);
  const [txn, setTxn] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!confirmed) {
      setError("Please confirm the spelling of your name.");
      return;
    }
    if (!file) {
      setError("Please upload your payment screenshot.");
      return;
    }

    setBusy(true);

    try {
      const data = new FormData();
      data.set("enrollmentId", enrollmentId);
      data.set("certificateName", name.trim());
      data.set("confirmName", "true");
      data.set("transactionId", txn.trim());
      data.set("screenshot", file);

      const response = await fetch("/api/internships/payment", {
        method: "POST",
        body: data,
      });
      const result = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;

      if (!response.ok) {
        setError(result?.error || "Could not submit your payment.");
        return;
      }

      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-4 space-y-3">
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}

      <label className="block text-sm font-medium">
        Name on certificate
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={100}
          className="mt-1 w-full rounded-lg border border-line bg-transparent px-3 py-2 font-normal"
        />
      </label>

      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
          className="mt-1"
        />
        <span>I confirm my name is spelled correctly for my certificate.</span>
      </label>

      <label className="block text-sm font-medium">
        Transaction ID
        <input
          required
          value={txn}
          onChange={(e) => setTxn(e.target.value)}
          maxLength={64}
          className="mt-1 w-full rounded-lg border border-line bg-transparent px-3 py-2 font-normal"
        />
      </label>

      <label className="block text-sm font-medium">
        Payment screenshot (PNG or JPEG, up to 4 MB)
        <input
          required
          type="file"
          accept="image/png,image/jpeg"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="mt-1 block w-full text-sm font-normal"
        />
      </label>

      <button type="submit" disabled={busy} className="btn disabled:opacity-60">
        {busy ? "Submitting..." : "Submit payment"}
      </button>
    </form>
  );
}
