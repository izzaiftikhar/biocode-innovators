"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase/client";

type Sub = {
  id: string;
  enrollment_id: string;
  task_id: string;
  file_path: string | null;
  link_url: string | null;
  notes: string | null;
  status: string;
  score: number | null;
  feedback: string | null;
  is_late: boolean;
  version: number;
  submitted_at: string;
};

type Pay = {
  id: string;
  enrollment_id: string;
  certificate_name: string;
  transaction_id: string;
  amount: number | null;
  screenshot_path: string;
  status: string;
  reject_reason: string | null;
  created_at: string;
};

type Enr = {
  id: string;
  internship_id: string;
  full_name: string;
  email: string;
  reference_id: string;
};

type Task = { id: string; position: number; title: string };
type Intern = { id: string; title: string };
type Draft = { score: string; feedback: string };

const box = "rounded-2xl border border-current/10 p-5 md:p-6";
const input =
  "mt-2 w-full rounded-xl border border-current/15 bg-transparent px-3.5 py-3 font-normal outline-none focus:border-current/40";

async function post(url: string, body: unknown) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const result = (await response.json().catch(() => null)) as {
    error?: string;
    emailSent?: boolean;
    alreadyIssued?: boolean;
  } | null;
  return { ok: response.ok, result };
}

export default function InternshipReview({ initialView = "tasks" }: { initialView?: "tasks" | "payments" }) {
  const supabase = useMemo(() => createBrowserSupabase(), []);

  const [view, setView] = useState<"tasks" | "payments">(initialView);
  const [pendingOnly, setPendingOnly] = useState(true);
  const [subs, setSubs] = useState<Sub[]>([]);
  const [pays, setPays] = useState<Pay[]>([]);
  const [enrollments, setEnrollments] = useState<Enr[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [internships, setInternships] = useState<Intern[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [previewBusy, setPreviewBusy] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");

    const [s, p, e, t, i] = await Promise.all([
      fetch("/api/admin/internships/final")
      .then((r) => r.json())
      .catch(() => ({ error: "Could not load submissions." })) as Promise<{
        submissions?: Sub[];
        error?: string;
      }>,
      supabase
        .from("internship_payments")
        .select("*")
        .order("created_at", { ascending: false }),
      supabase
        .from("internship_enrollments")
        .select("id, internship_id, full_name, email, reference_id"),
      supabase.from("internship_tasks").select("id, position, title"),
      supabase.from("internships").select("id, title"),
    ]);

    const firstError = p.error || e.error || t.error || i.error;
    if (s.error) setError(s.error);
    else if (firstError) setError(firstError.message);

    setSubs(s.submissions ?? []);
    setPays((p.data ?? []) as Pay[]);
    setEnrollments((e.data ?? []) as Enr[]);
    setTasks((t.data ?? []) as Task[]);
    setInternships((i.data ?? []) as Intern[]);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    void load();
  }, [load]);

  const enrollmentOf = (id: string) => enrollments.find((x) => x.id === id);
  const taskOf = (id: string) => tasks.find((x) => x.id === id);
  const titleOf = (enrollmentId: string) => {
    const enrollment = enrollmentOf(enrollmentId);
    return internships.find((x) => x.id === enrollment?.internship_id)?.title;
  };

  async function openFile(path: string) {
    setError("");
    const { data, error: signError } = await supabase.storage
      .from("internship-files")
      .createSignedUrl(path, 600);

    if (signError || !data?.signedUrl) {
      setError(signError?.message ?? "Could not open the file.");
      return;
    }

    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }

  async function review(sub: Sub, decision: "approved" | "needs_revision") {
    setMessage("");
    setError("");
    const draft = drafts[sub.id] ?? {
      score: sub.score == null ? "" : String(sub.score),
      feedback: sub.feedback ?? "",
    };

    setBusyId(sub.id);
    const { ok, result } = await post("/api/admin/internships/final", {
      submissionId: sub.id,
      decision,
      score: draft.score.trim() === "" ? null : Number(draft.score),
      feedback: draft.feedback,
    });
    setBusyId(null);

    if (!ok) {
      setError(result?.error || "Could not save the review.");
      return;
    }

    setMessage(
      decision === "approved" ? "Task approved." : "Revision requested."
    );
    await load();
  }

  async function decidePayment(pay: Pay, decision: "approved" | "rejected") {
    setMessage("");
    setError("");

    if (
      decision === "approved" &&
      !window.confirm(
        "Approve this payment? The certificate will be generated and emailed to the intern."
      )
    ) {
      return;
    }

    setBusyId(pay.id);
    const { ok, result } = await post("/api/admin/internships/payment", {
      paymentId: pay.id,
      decision,
      reason: reasons[pay.id] ?? "",
    });
    setBusyId(null);

    if (!ok) {
      setError(result?.error || "Could not save the decision.");
      return;
    }

    setMessage(
      decision === "approved"
        ? result?.alreadyIssued
          ? "Payment approved. A certificate already existed for this intern."
          : result?.emailSent
            ? "Payment approved. Certificate issued and emailed."
            : "Payment approved. Certificate issued, but the email could not be sent. The intern can download it from their dashboard."
        : "Payment rejected. The intern can resubmit."
    );
    await load();
  }

  async function previewDocument(
    pay: Pay,
    kind: "certificate" | "appreciation"
  ) {
    setError("");
    const key = `${pay.id}:${kind}`;
    setPreviewBusy(key);

    try {
      const response = await fetch("/api/admin/internships/certificate-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentId: pay.id, kind }),
      });

      if (!response.ok) {
        const result = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        setError(result?.error || "Could not create the preview.");
        return;
      }

      const url = URL.createObjectURL(await response.blob());

      setPreviews((current) => {
        if (current[key]) URL.revokeObjectURL(current[key]);
        return { ...current, [key]: url };
      });
    } catch {
      setError("Could not create the preview.");
    } finally {
      setPreviewBusy(null);
    }
  }

  function closePreview(key: string) {
    setPreviews((current) => {
      if (current[key]) URL.revokeObjectURL(current[key]);
      const next = { ...current };
      delete next[key];
      return next;
    });
  }

  const shownSubs = subs.filter((s) => !pendingOnly || s.status === "submitted");
  const shownPays = pays.filter((p) => !pendingOnly || p.status === "pending");

  const tab = (active: boolean) =>
    `rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
      active
        ? "bg-cyan-200 text-slate-900"
        : "border border-current/15 hover:bg-current/5"
    }`;

  return (
    <main className="container-page py-10 md:py-14">
      <header className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
          Internship review
        </h1>
        <p className="mt-3 max-w-2xl text-muted">
          Review task submissions, then verify payments. Approving a payment
          issues and emails the certificate.
        </p>
      </header>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <button type="button" className={tab(view === "tasks")} onClick={() => setView("tasks")}>
          Task submissions
        </button>
        <button type="button" className={tab(view === "payments")} onClick={() => setView("payments")}>
          Payments
        </button>

        <label className="ml-auto flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={pendingOnly}
            onChange={(e) => setPendingOnly(e.target.checked)}
            className="size-4"
          />
          Pending only
        </label>

        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="rounded-xl border border-current/15 px-4 py-2.5 text-sm hover:bg-current/5 disabled:opacity-50"
        >
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {message && (
        <p role="status" className="mb-5 rounded-xl border border-green-600/30 p-3 text-sm">
          {message}
        </p>
      )}
      {error && (
        <p role="alert" className="mb-5 break-words rounded-xl border border-red-500/40 p-3 text-sm">
          {error}
        </p>
      )}

      {loading ? (
        <p className="py-10 text-muted">Loading...</p>
      ) : view === "tasks" ? (
        shownSubs.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-current/20 p-8 text-center text-muted">
            No task submissions to show.
          </p>
        ) : (
          <div className="space-y-5">
            {shownSubs.map((sub) => {
              const enrollment = enrollmentOf(sub.enrollment_id);
              const draft = drafts[sub.id] ?? {
                score: sub.score == null ? "" : String(sub.score),
                feedback: sub.feedback ?? "",
              };
              const busy = busyId === sub.id;

              return (
                <article key={sub.id} className={box}>
                  <h2 className="text-lg font-semibold">
                    {enrollment?.full_name ?? "Unknown student"} · Final submission
                  </h2>
                  <p className="mt-1 text-sm text-muted">
                    {titleOf(sub.enrollment_id)} · {enrollment?.email} ·{" "}
                    {enrollment?.reference_id}
                  </p>

                  <div className="mt-3 flex flex-wrap gap-2 text-xs">
                    <span className="rounded-full border border-current/15 px-3 py-1 capitalize">
                      {sub.status.replace("_", " ")}
                    </span>
                    <span className="rounded-full border border-current/15 px-3 py-1">
                      Version {sub.version}
                    </span>
                    {sub.is_late && (
                      <span className="rounded-full border border-amber-500/50 px-3 py-1">
                        Late
                      </span>
                    )}
                    <span className="rounded-full border border-current/15 px-3 py-1">
                      {new Date(sub.submitted_at).toLocaleString()}
                    </span>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
                    {sub.link_url && (
                      <a
                        href={sub.link_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="break-all underline underline-offset-4"
                      >
                        {sub.link_url}
                      </a>
                    )}
                    {sub.file_path && (
                      <button
                        type="button"
                        onClick={() => void openFile(sub.file_path!)}
                        className="rounded-xl bg-cyan-200 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-cyan-300"
                      >
                        Open uploaded file
                      </button>
                    )}
                  </div>

                  {sub.notes && (
                    <p className="mt-3 whitespace-pre-line text-sm text-muted">
                      Student notes: {sub.notes}
                    </p>
                  )}

                  <div className="mt-5 space-y-3 border-t border-current/10 pt-5">
                    <label className="block text-sm font-medium">
                      Score out of 100 (optional)
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step={1}
                        value={draft.score}
                        disabled={busy}
                        onChange={(e) =>
                          setDrafts((c) => ({
                            ...c,
                            [sub.id]: { ...draft, score: e.target.value },
                          }))
                        }
                        className={input}
                      />
                    </label>

                    <label className="block text-sm font-medium">
                      Feedback (required for revisions)
                      <textarea
                        rows={3}
                        value={draft.feedback}
                        disabled={busy}
                        onChange={(e) =>
                          setDrafts((c) => ({
                            ...c,
                            [sub.id]: { ...draft, feedback: e.target.value },
                          }))
                        }
                        className={input}
                      />
                    </label>

                    <div className="flex flex-wrap gap-3">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void review(sub, "approved")}
                        className="rounded-xl bg-cyan-200 px-4 py-3 text-sm font-semibold text-slate-900 hover:bg-cyan-300 disabled:opacity-50"
                      >
                        {busy ? "Saving..." : "Approve"}
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void review(sub, "needs_revision")}
                        className="rounded-xl border border-amber-500/50 px-4 py-3 text-sm font-semibold hover:bg-amber-500/10 disabled:opacity-50"
                      >
                        Request revision
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )
      ) : shownPays.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-current/20 p-8 text-center text-muted">
          No payments to show.
        </p>
      ) : (
        <div className="space-y-5">
          {shownPays.map((pay) => {
            const enrollment = enrollmentOf(pay.enrollment_id);
            const busy = busyId === pay.id;

            return (
              <article key={pay.id} className={box}>
                <h2 className="text-lg font-semibold">
                  {enrollment?.full_name ?? "Unknown student"}
                </h2>
                <p className="mt-1 text-sm text-muted">
                  {titleOf(pay.enrollment_id)} · {enrollment?.email} ·{" "}
                  {enrollment?.reference_id}
                </p>

                <dl className="mt-3 grid gap-1 text-sm">
                  <div>Name on certificate: <strong>{pay.certificate_name}</strong></div>
                  <div>Transaction ID: <strong>{pay.transaction_id}</strong></div>
                  <div>Fee on record: {pay.amount ?? "Not set"}</div>
                  <div className="capitalize">Status: {pay.status}</div>
                  {pay.reject_reason && <div>Reason given: {pay.reject_reason}</div>}
                </dl>

                <button
                  type="button"
                  onClick={() => void openFile(pay.screenshot_path)}
                  className="mt-4 rounded-xl bg-cyan-200 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-cyan-300"
                >
                  Open payment screenshot
                </button>

                {pay.status !== "approved" && (
                  <div className="mt-4">
                    <p className="text-sm font-medium">
                      Check how the name will look before issuing
                    </p>

                    <div className="mt-2 flex flex-wrap gap-3">
                      {(["certificate", "appreciation"] as const).map((kind) => {
                        const key = `${pay.id}:${kind}`;

                        return (
                          <button
                            key={kind}
                            type="button"
                            disabled={previewBusy === key}
                            onClick={() => void previewDocument(pay, kind)}
                            className="rounded-xl border border-current/15 px-4 py-2 text-sm hover:bg-current/5 disabled:opacity-50"
                          >
                            {previewBusy === key
                              ? "Rendering..."
                              : kind === "certificate"
                                ? "Preview certificate"
                                : "Preview appreciation letter"}
                          </button>
                        );
                      })}
                    </div>

                    {(["certificate", "appreciation"] as const).map((kind) => {
                      const key = `${pay.id}:${kind}`;
                      const url = previews[key];
                      if (!url) return null;

                      return (
                        <div key={kind} className="mt-4">
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-xs text-muted">
                              Preview only. Nothing has been issued or emailed.
                            </p>
                            <button
                              type="button"
                              onClick={() => closePreview(key)}
                              className="text-xs underline"
                            >
                              Close
                            </button>
                          </div>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={url}
                            alt={`${kind} preview`}
                            className="mt-2 w-full max-w-3xl rounded-lg border border-current/10"
                          />
                        </div>
                      );
                    })}
                  </div>
                )}

                {pay.status === "pending" && (
                  <div className="mt-5 space-y-3 border-t border-current/10 pt-5">
                    <label className="block text-sm font-medium">
                      Reason (required to reject)
                      <input
                        value={reasons[pay.id] ?? ""}
                        disabled={busy}
                        onChange={(e) =>
                          setReasons((c) => ({ ...c, [pay.id]: e.target.value }))
                        }
                        className={input}
                        placeholder="e.g. Amount does not match or screenshot unclear"
                      />
                    </label>

                    <div className="flex flex-wrap gap-3">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void decidePayment(pay, "approved")}
                        className="rounded-xl bg-cyan-200 px-4 py-3 text-sm font-semibold text-slate-900 hover:bg-cyan-300 disabled:opacity-50"
                      >
                        {busy ? "Working..." : "Verify and issue certificate"}
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void decidePayment(pay, "rejected")}
                        className="rounded-xl border border-red-500/40 px-4 py-3 text-sm font-semibold text-red-600 hover:bg-red-500/5 disabled:opacity-50"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </main>
  );
}
