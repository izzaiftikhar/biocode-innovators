"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

const MAX_BYTES = 4 * 1024 * 1024;

export default function InternshipFinalForm({
  enrollmentId,
  resubmit,
}: {
  enrollmentId: string;
  resubmit: boolean;
}) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [link, setLink] = useState("");
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function clearFile() {
    setFile(null);
    if (fileInput.current) fileInput.current.value = "";
  }

  function pickFile(next: File | null) {
    setError("");

    if (next && next.size > MAX_BYTES) {
      setError(
        `That file is ${(next.size / 1048576).toFixed(1)} MB and the limit is 4 MB. For bigger projects, upload to GitHub and paste the link instead.`
      );
      clearFile();
      return;
    }

    setFile(next);
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!file && !link.trim()) {
      setError("Upload one combined ZIP, or paste a GitHub / live link.");
      return;
    }

    setBusy(true);

    try {
      const data = new FormData();
      data.set("enrollmentId", enrollmentId);
      data.set("linkUrl", link.trim());
      data.set("notes", notes.trim());
      if (file) data.set("file", file);

      const response = await fetch("/api/internships/submit", {
        method: "POST",
        body: data,
      });
      const result = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;

      if (!response.ok) {
        setError(result?.error || "Could not submit. Please try again.");
        return;
      }

      setOpen(false);
      setLink("");
      setNotes("");
      clearFile();
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="btn-outline mt-3">
        {resubmit ? "Resubmit your work" : "Submit your work"}
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="mt-4 space-y-3">
      {error && (
        <p role="alert" className="break-words text-sm text-red-700">
          {error}
        </p>
      )}

      <div>
        <label className="block text-sm font-medium" htmlFor="final-zip">
          One combined ZIP with all tasks (up to 4 MB)
        </label>
        <input
          id="final-zip"
          ref={fileInput}
          type="file"
          accept=".zip"
          disabled={busy}
          onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
          className="mt-1 block w-full text-sm font-normal"
        />

        {file && (
          <div className="mt-2 flex flex-wrap items-center gap-3 rounded-lg bg-surface p-2 text-sm">
            <span className="min-w-0 break-all">
              {file.name} ({(file.size / 1048576).toFixed(1)} MB)
            </span>
            <button
              type="button"
              onClick={clearFile}
              disabled={busy}
              className="rounded-lg border border-red-500/40 px-3 py-1 text-xs text-red-600 hover:bg-red-500/5 disabled:opacity-50"
            >
              Remove file
            </button>
          </div>
        )}
      </div>

      <label className="block text-sm font-medium">
        Or a GitHub / live link (for larger projects)
        <input
          value={link}
          onChange={(e) => setLink(e.target.value)}
          disabled={busy}
          maxLength={500}
          placeholder="https://github.com/you/project"
          className="mt-1 w-full rounded-lg border border-line bg-transparent px-3 py-2 font-normal"
        />
      </label>

      <label className="block text-sm font-medium">
        Notes (optional)
        <textarea
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          disabled={busy}
          maxLength={1000}
          className="mt-1 w-full rounded-lg border border-line bg-transparent px-3 py-2 font-normal"
        />
      </label>

      <div className="flex gap-3">
        <button type="submit" disabled={busy} className="btn disabled:opacity-60">
          {busy ? "Submitting..." : "Submit"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          disabled={busy}
          className="btn-outline"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
