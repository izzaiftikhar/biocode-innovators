"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase/client";
import InternshipReview from "./InternshipReview";

type Submission = {
  id: string;
  user_id: string;
  assignment_id: string;
  file_path: string | null;
  score: number | null;
  review_status: string | null;
  mentor_comment: string | null;
  created_at: string | null;
};

type Assignment = {
  id: string;
  kind: string;
  prompt: string | null;
  config: {
    title?: string;
  } | null;
};

type ReviewForm = {
  score: string;
  feedback: string;
};

const sectionClass = "rounded-2xl border border-current/10 p-5 md:p-6";

const inputClass =
  "mt-2 w-full rounded-xl border border-current/15 bg-transparent px-3.5 py-3 font-normal outline-none focus:border-current/40";

const MAX_MARKS = 20;

function CourseAssignmentsPanel() {
  const supabase = useMemo(() => createBrowserSupabase(), []);

  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [downloadLinks, setDownloadLinks] = useState<Record<string, string>>(
    {},
  );
  const [reviews, setReviews] = useState<Record<string, ReviewForm>>({});
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");

  const loadSubmissions = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const { data, error: fetchError } = await supabase
        .from("submissions")
        .select(
          "id, user_id, assignment_id, file_path, score, review_status, mentor_comment, created_at",
        )
        .order("created_at", { ascending: false });

      if (fetchError) {
        setError(fetchError.message);
        setSubmissions([]);
        setAssignments([]);
        return;
      }

      const rows = (data ?? []) as Submission[];
      setSubmissions(rows);

      setReviews((current) => {
        const next = { ...current };

        for (const row of rows) {
          if (!next[row.id]) {
            next[row.id] = {
              score: row.score == null ? "" : String(row.score),
              feedback: row.mentor_comment ?? "",
            };
          }
        }

        return next;
      });

      const assignmentIds = [
        ...new Set(rows.map((row) => row.assignment_id)),
      ];

      if (assignmentIds.length === 0) {
        setAssignments([]);
        return;
      }

      const { data: assignmentData, error: assignmentError } = await supabase
        .from("assignments")
        .select("id, kind, prompt, config")
        .in("id", assignmentIds);

      if (assignmentError) {
        setError(
          `Submissions loaded, but assignment details could not be loaded: ${assignmentError.message}`,
        );
        setAssignments([]);
        return;
      }

      setAssignments((assignmentData ?? []) as Assignment[]);
    } catch {
      setError("Something went wrong while loading submissions.");
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    void loadSubmissions();
  }, [loadSubmissions]);

  async function createDownloadLink(submission: Submission) {
    if (!submission.file_path) {
      setError("This submission does not have an uploaded file.");
      return;
    }

    setDownloadingId(submission.id);
    setError("");
    setMessage("");

    try {
      const { data, error: linkError } = await supabase.storage
        .from("course-assignments")
        .createSignedUrl(submission.file_path, 60 * 10);

      if (linkError) {
        setError(`Could not create the download link: ${linkError.message}`);
        return;
      }

      if (!data?.signedUrl) {
        setError("Supabase did not return a download link.");
        return;
      }

      setDownloadLinks((current) => ({
        ...current,
        [submission.id]: data.signedUrl,
      }));

      setMessage("A private download link is ready. It expires in 10 minutes.");
    } catch {
      setError("Could not create the download link. Please try again.");
    } finally {
      setDownloadingId(null);
    }
  }

  function getAssignmentTitle(assignmentId: string) {
    const assignment = assignments.find((item) => item.id === assignmentId);

    return (
      assignment?.config?.title ||
      assignment?.prompt ||
      "Untitled assignment"
    );
  }

  function updateReview(
    submissionId: string,
    field: keyof ReviewForm,
    value: string,
  ) {
    setReviews((current) => ({
      ...current,
      [submissionId]: {
        score: current[submissionId]?.score ?? "",
        feedback: current[submissionId]?.feedback ?? "",
        [field]: value,
      },
    }));
  }

  async function saveReview(
    submission: Submission,
    decision: "approved" | "changes_requested",
  ) {
    setError("");
    setMessage("");

    const review = reviews[submission.id] ?? {
      score: "",
      feedback: "",
    };

    const parsedScore = Number(review.score);

    // Validate the score against the 20-mark limit.
    if (
      review.score.trim() === "" ||
      !Number.isInteger(parsedScore) ||
      parsedScore < 0 ||
      parsedScore > MAX_MARKS
    ) {
      setError(`Enter a whole-number score between 0 and ${MAX_MARKS}.`);
      return;
    }

    if (!review.feedback.trim()) {
      setError("Please enter feedback before saving the review.");
      return;
    }

    if (decision === "changes_requested" && !review.feedback.trim()) {
      setError("Explain what the student needs to correct.");
      return;
    }

    setSavingId(submission.id);

    try {
      // The server re-checks the admin role, saves the review, and unlocks
      // the next module when every assignment in the module is approved.
      const response = await fetch("/api/admin/submissions/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          submissionId: submission.id,
          decision,
          score: parsedScore,
          feedback: review.feedback.trim(),
        }),
      });

      const result = (await response.json().catch(() => null)) as {
        error?: string;
        submission?: Submission;
        moduleCompleted?: boolean;
        courseComplete?: boolean;
      } | null;

      if (!response.ok || !result?.submission) {
        setError(result?.error || "Could not save the review.");
        return;
      }

      const updated = result.submission;

      setSubmissions((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );

      setReviews((current) => ({
        ...current,
        [updated.id]: {
          score: String(updated.score ?? ""),
          feedback: updated.mentor_comment ?? "",
        },
      }));

      setMessage(
        decision === "approved"
          ? result.courseComplete
            ? "Approved. This was the final module, so the student has finished the course."
            : result.moduleCompleted
              ? "Approved. The next module is now unlocked for the student."
              : "Grade saved and submission approved."
          : "Grade saved and corrections requested.",
      );
    } catch {
      setError("An unexpected error occurred while saving the review.");
    } finally {
      setSavingId(null);
    }
  }

  const filteredSubmissions = submissions.filter((submission) => {
    const assignmentTitle = getAssignmentTitle(submission.assignment_id);

    return [
      assignmentTitle,
      submission.user_id,
      submission.review_status ?? "pending",
      submission.file_path ?? "",
    ]
      .join(" ")
      .toLowerCase()
      .includes(search.toLowerCase());
  });

  function formatDate(value: string | null) {
    if (!value) return "Date unavailable";

    const date = new Date(value);

    return Number.isNaN(date.getTime())
      ? "Date unavailable"
      : date.toLocaleString();
  }

  function formatStatus(value: string | null) {
    if (!value) return "Pending review";

    return value.replaceAll("_", " ");
  }

  return (
    <main className="container-page py-10 md:py-14">
      <header className="mb-9">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-muted">
          BioCode Innovators · Research Wing
        </p>

        <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
          Submissions &amp; Grading
        </h1>

        <p className="mt-3 max-w-2xl text-muted">
          Download student work, enter a score out of {MAX_MARKS}, leave
          feedback, and approve the assignment or request corrections.
        </p>
      </header>

      <section className={`${sectionClass} mb-8`}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">Student submissions</h2>

            <p className="mt-1 text-sm text-muted">
              {submissions.length}{" "}
              {submissions.length === 1 ? "submission" : "submissions"} found
            </p>
          </div>

          <button
            type="button"
            onClick={() => void loadSubmissions()}
            disabled={loading}
            className="rounded-xl border border-current/15 px-4 py-2.5 text-sm transition hover:bg-current/5 disabled:opacity-50"
          >
            {loading ? "Refreshing..." : "Refresh list"}
          </button>
        </div>

        <label className="mt-5 block text-sm font-medium">
          Search submissions

          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Assignment, student ID, status, or file path"
            className={inputClass}
          />
        </label>
      </section>

      {message && (
        <p
          role="status"
          className="mb-5 rounded-xl border border-green-600/30 p-3 text-sm"
        >
          {message}
        </p>
      )}

      {error && (
        <p
          role="alert"
          className="mb-5 break-words rounded-xl border border-red-500/40 p-3 text-sm"
        >
          {error}
        </p>
      )}

      {loading ? (
        <p className="py-10 text-muted">Loading submissions...</p>
      ) : filteredSubmissions.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-current/20 p-8 text-center">
          <h2 className="font-semibold">No submissions found</h2>

          <p className="mt-2 text-sm text-muted">
            {submissions.length === 0
              ? "When students submit assignments, their records will appear here."
              : "Try a different search term."}
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {filteredSubmissions.map((submission) => {
            const review = reviews[submission.id] ?? {
              score:
                submission.score == null ? "" : String(submission.score),
              feedback: submission.mentor_comment ?? "",
            };

            const isSaving = savingId === submission.id;

            return (
              <article key={submission.id} className={sectionClass}>
                <div className="flex flex-col justify-between gap-5 md:flex-row">
                  <div className="min-w-0 flex-1">
                    <h2 className="text-lg font-semibold">
                      {getAssignmentTitle(submission.assignment_id)}
                    </h2>

                    <p className="mt-2 break-all text-sm text-muted">
                      Student ID: {submission.user_id}
                    </p>

                    <p className="mt-1 break-all text-sm text-muted">
                      Submission ID: {submission.id}
                    </p>

                    <p className="mt-2 text-sm text-muted">
                      Submitted: {formatDate(submission.created_at)}
                    </p>

                    <div className="mt-3 flex flex-wrap gap-2 text-xs">
                      <span className="rounded-full border border-current/15 px-3 py-1 capitalize">
                        Status: {formatStatus(submission.review_status)}
                      </span>

                      <span className="rounded-full border border-current/15 px-3 py-1">
                        Score:{" "}
                        {submission.score == null
                          ? "Not graded"
                          : `${submission.score}/${MAX_MARKS}`}
                      </span>
                    </div>

                    {submission.file_path && (
                      <p className="mt-3 break-all text-xs text-muted">
                        File: {submission.file_path.split("/").pop()}
                      </p>
                    )}

                    <div className="mt-6 space-y-4 border-t border-current/10 pt-5">
                      <h3 className="font-semibold">Review this assignment</h3>

                      <label className="block text-sm font-medium">
                        Score (out of {MAX_MARKS})

                        <input
                          type="number"
                          min={0}
                          max={MAX_MARKS}
                          step={1}
                          value={review.score}
                          onChange={(event) =>
                            updateReview(
                              submission.id,
                              "score",
                              event.target.value,
                            )
                          }
                          disabled={isSaving}
                          className={inputClass}
                          placeholder="e.g. 17"
                        />
                      </label>

                      <label className="block text-sm font-medium">
                        Feedback for the student

                        <textarea
                          rows={4}
                          value={review.feedback}
                          onChange={(event) =>
                            updateReview(
                              submission.id,
                              "feedback",
                              event.target.value,
                            )
                          }
                          disabled={isSaving}
                          className={inputClass}
                          placeholder="Write feedback or explain what needs correction..."
                        />
                      </label>

                      <div className="flex flex-wrap gap-3">
                        <button
                          type="button"
                          onClick={() =>
                            void saveReview(submission, "approved")
                          }
                          disabled={isSaving}
                          className="rounded-xl bg-cyan-200 px-4 py-3 text-sm font-semibold text-slate-900 transition hover:bg-cyan-300 disabled:opacity-50"
                        >
                          {isSaving ? "Saving..." : "Save & approve"}
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            void saveReview(submission, "changes_requested")
                          }
                          disabled={isSaving}
                          className="rounded-xl border border-amber-500/50 px-4 py-3 text-sm font-semibold transition hover:bg-amber-500/10 disabled:opacity-50"
                        >
                          {isSaving
                            ? "Saving..."
                            : "Save & request corrections"}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-wrap items-start gap-2 md:flex-col">
                    {submission.file_path ? (
                      downloadLinks[submission.id] ? (
                        <a
                          href={downloadLinks[submission.id]}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rounded-xl bg-cyan-200 px-4 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-cyan-300"
                        >
                          Download submission
                        </a>
                      ) : (
                        <button
                          type="button"
                          onClick={() => void createDownloadLink(submission)}
                          disabled={downloadingId === submission.id}
                          className="rounded-xl bg-cyan-200 px-4 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-cyan-300 disabled:opacity-50"
                        >
                          {downloadingId === submission.id
                            ? "Preparing link..."
                            : "Prepare download"}
                        </button>
                      )
                    ) : (
                      <span className="text-sm text-muted">
                        No uploaded file
                      </span>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <footer className="mt-10 border-t border-current/10 pt-6">
        <a
          href="/admin"
          className="text-sm text-muted underline underline-offset-4 hover:text-primary"
        >
          Back to admin dashboard
        </a>
      </footer>
    </main>
  );
}

export default function AdminSubmissions() {
  const [tab, setTab] = useState<"course" | "internship">("course");

  const tabClass = (active: boolean) =>
    `rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
      active
        ? "bg-cyan-200 text-slate-900"
        : "border border-current/15 hover:bg-current/5"
    }`;

  return (
    <div>
      <div className="container-page flex flex-wrap gap-3 pt-8">
        <button type="button" onClick={() => setTab("course")} className={tabClass(tab === "course")}>
          Course Assignments
        </button>
        <button type="button" onClick={() => setTab("internship")} className={tabClass(tab === "internship")}>
          Internship Tasks
        </button>
      </div>

      {tab === "course" ? <CourseAssignmentsPanel /> : <InternshipReview />}
    </div>
  );
}
