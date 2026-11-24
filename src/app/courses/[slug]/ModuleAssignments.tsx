"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { createBrowserClient } from "@supabase/ssr";

type Assignment = {
  id: string;
  kind: string;
  prompt: string | null;
  config: {
    title?: string;
    deadline?: string;
    file_name?: string;
    file_path?: string;
  } | null;
};

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

const MAX_FILE_SIZE = 50 * 1024 * 1024;
const MAX_MARKS = 20;
const TEAL = "#0e7490";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error("Assignment service is not configured.");
  }

  return createBrowserClient(url, key);
}

const PATHS = {
  clock: "M12 7v5l3 2M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
  download: "M12 3v12m0 0l-4-4m4 4l4-4M4 21h16",
  upload: "M12 15V3m0 0L8 7m4-4l4 4M4 21h16",
  file: "M7 3h7l5 5v13H7V3zM14 3v5h5",
};

function Svg({ d, size = 16 }: { d: string; size?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={d} />
    </svg>
  );
}

function formatDeadline(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return { text: value, past: false };
  }

  return {
    text: date.toLocaleString(undefined, {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }),
    past: date.getTime() < Date.now(),
  };
}

function formatSize(bytes: number) {
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function renderPrompt(prompt: string): ReactNode {
  const blocks: ReactNode[] = [];
  let listItems: string[] = [];

  const flushList = () => {
    if (listItems.length === 0) return;

    const items = listItems;
    listItems = [];

    blocks.push(
      <ol
        key={`ol-${blocks.length}`}
        className="list-decimal space-y-1.5 pl-6 marker:font-semibold marker:text-[#0e7490]"
      >
        {items.map((item, index) => (
          <li key={index} className="pl-1">
            {item}
          </li>
        ))}
      </ol>,
    );
  };

  prompt.split("\n").forEach((rawLine) => {
    const line = rawLine.trim();
    const numbered = line.match(/^\d+[.)]\s+(.*)$/);

    if (numbered) {
      listItems.push(numbered[1]);
      return;
    }

    flushList();

    if (line) {
      blocks.push(<p key={`p-${blocks.length}`}>{line}</p>);
    }
  });

  flushList();

  return blocks;
}

function statusLabel(status: string | null) {
  switch (status) {
    case "approved":
      return "Approved";
    case "changes_requested":
      return "Corrections requested";
    case "pending":
      return "Awaiting admin review";
    default:
      return status
        ? status.replaceAll("_", " ")
        : "Awaiting admin review";
  }
}

function statusClasses(status: string | null) {
  switch (status) {
    case "approved":
      return "bg-emerald-50 text-emerald-800";
    case "changes_requested":
      return "bg-amber-50 text-amber-900";
    default:
      return "bg-slate-100 text-slate-700";
  }
}

export default function ModuleAssignments({
  moduleId,
}: {
  moduleId: string;
}) {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [openSection, setOpenSection] = useState<
    Record<string, string | null>
  >({});
  const [submissions, setSubmissions] = useState<
    Record<string, Submission>
  >({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<
    Record<string, File | null>
  >({});
  const [uploadingId, setUploadingId] = useState("");
  const [messages, setMessages] = useState<Record<string, string>>({});

  function toggleSection(assignmentId: string, section: string) {
    setOpenSection((previous) => ({
      ...previous,
      [assignmentId]:
        previous[assignmentId] === section ? null : section,
    }));
  }

  const loadStudentSubmissions = useCallback(
    async (assignmentIds: string[]) => {
      if (assignmentIds.length === 0) {
        setSubmissions({});
        return;
      }

      const supabase = getSupabase();

      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) throw authError;

      if (!user) {
        setSubmissions({});
        return;
      }

      const { data, error: submissionError } = await supabase
        .from("submissions")
        .select(
          "id, user_id, assignment_id, file_path, score, review_status, mentor_comment, created_at",
        )
        .eq("user_id", user.id)
        .in("assignment_id", assignmentIds)
        .order("created_at", { ascending: false });

      if (submissionError) throw submissionError;

      // The newest submission is the current submission for each assignment.
      const latest: Record<string, Submission> = {};

      for (const row of (data ?? []) as Submission[]) {
        if (!latest[row.assignment_id]) {
          latest[row.assignment_id] = row;
        }
      }

      setSubmissions(latest);
    },
    [],
  );

  const loadAssignments = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const supabase = getSupabase();

      const { data, error: fetchError } = await supabase
        .from("assignments")
        .select("id, kind, prompt, config")
        .eq("module_id", moduleId);

      if (fetchError) throw fetchError;

      const rows = (data ?? []) as Assignment[];

      setAssignments(rows);

      await loadStudentSubmissions(
        rows.map((assignment) => assignment.id),
      );
    } catch (err) {
      console.error("Unable to load assignments or reviews:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Unable to load assignments. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }, [moduleId, loadStudentSubmissions]);

  useEffect(() => {
    void loadAssignments();
  }, [loadAssignments]);

  async function downloadAttachment(path: string) {
    try {
      const supabase = getSupabase();

      const { data, error } = await supabase.storage
        .from("course-assignments")
        .createSignedUrl(path, 60);

      if (error || !data?.signedUrl) {
        throw error ?? new Error("Download link was not returned.");
      }

      window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    } catch (err) {
      console.error("Attachment download error:", err);

      alert(
        err instanceof Error
          ? err.message
          : "Unable to download attachment.",
      );
    }
  }

  async function submitAssignment(assignment: Assignment) {
    const assignmentId = assignment.id;
    const file = selectedFiles[assignmentId];

    if (!file) {
      setMessages((previous) => ({
        ...previous,
        [assignmentId]: "Please choose a file first.",
      }));
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setMessages((previous) => ({
        ...previous,
        [assignmentId]: "The file must be 50 MB or smaller.",
      }));
      return;
    }

    setUploadingId(assignmentId);
    setMessages((previous) => ({
      ...previous,
      [assignmentId]: "",
    }));

    let uploadedPath = "";

    try {
      const supabase = getSupabase();

      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) throw authError;

      if (!user) {
        throw new Error(
          "Please sign in before submitting your assignment.",
        );
      }

      // Step 1: the server checks every rule (unlocked, 90% watched, deadline,
      // not already approved) and only then issues a one-time upload slot.
      const prepareResponse = await fetch("/api/assignments/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "prepare",
          assignmentId,
          fileName: file.name,
          fileSize: file.size,
        }),
      });

      const prepared = (await prepareResponse
        .json()
        .catch(() => null)) as {
        path?: string;
        token?: string;
        error?: string;
      } | null;

      if (!prepareResponse.ok || !prepared?.path || !prepared?.token) {
        throw new Error(
          prepared?.error || "You cannot submit this assignment yet.",
        );
      }

      // Step 2: upload straight to private storage with that slot.
      const { error: uploadError } = await supabase.storage
        .from("course-assignments")
        .uploadToSignedUrl(prepared.path, prepared.token, file, {
          contentType: file.type || "application/octet-stream",
        });

      if (uploadError) throw uploadError;

      uploadedPath = prepared.path;

      // Step 3: the server confirms the file and records the submission.
      const finalizeResponse = await fetch("/api/assignments/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "finalize",
          assignmentId,
          filePath: uploadedPath,
        }),
      });

      if (!finalizeResponse.ok) {
        const result = await finalizeResponse.json().catch(() => null);
        throw new Error(
          result?.error || "Your submission could not be saved.",
        );
      }

      // Refresh the saved submission so the dashboard shows its latest status.
      await loadStudentSubmissions(
        assignments.map((item) => item.id),
      );

      let notificationMessage =
        "Assignment submitted successfully! Worth 20 marks. Status: Pending review.";

      try {
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError) throw sessionError;

        if (!session?.access_token) {
          throw new Error(
            "Please sign in again to send the notification.",
          );
        }

        const response = await fetch("/api/assignment-notification", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            assignmentId,
            filePath: uploadedPath,
            fileName: file.name,
            assignmentTitle:
              assignment.config?.title || "Module Assignment",
          }),
        });

        if (!response.ok) {
          const result = await response.json().catch(() => null);

          throw new Error(
            result?.error ||
              "The admin email notification could not be sent.",
          );
        }

        notificationMessage += " Admin email notification sent.";
      } catch (emailError) {
        console.error("Assignment notification failed:", emailError);

        notificationMessage +=
          " However, the admin email notification failed. Please contact BioCode.";
      }

      setSelectedFiles((previous) => ({
        ...previous,
        [assignmentId]: null,
      }));

      setMessages((previous) => ({
        ...previous,
        [assignmentId]: notificationMessage,
      }));

      const input = document.getElementById(
        `assignment-file-${assignmentId}`,
      ) as HTMLInputElement | null;

      if (input) input.value = "";
    } catch (err) {
      console.error("Assignment submission error:", err);

      setMessages((previous) => ({
        ...previous,
        [assignmentId]:
          err instanceof Error
            ? err.message
            : "Submission failed. Please try again.",
      }));
    } finally {
      setUploadingId("");
    }
  }

  if (loading) {
    return (
      <p className="text-sm text-muted">
        Loading assignments...
      </p>
    );
  }

  if (error) {
    return (
      <p role="alert" className="text-sm text-muted">
        {error}
      </p>
    );
  }

  if (assignments.length === 0) {
    return null;
  }

  return (
    <div className="border-t border-line pt-5">
      <h4 className="mb-4 text-sm font-semibold">
        {assignments.length === 1 ? "Assignment" : "Assignments"}
      </h4>

      <div className="space-y-5">
        {assignments.map((assignment) => {
          const config = assignment.config ?? {};
          const submission = submissions[assignment.id];
          const isUploading = uploadingId === assignment.id;
          const selected = selectedFiles[assignment.id];
          const message = messages[assignment.id];

          const isSuccess =
            !!message && message.includes("submitted successfully");

          const deadline = config.deadline
            ? formatDeadline(config.deadline)
            : null;

          const canResubmit =
            !submission ||
            submission.review_status === "changes_requested" ||
            submission.review_status === "pending";

          const currentOpenSection = openSection[assignment.id];

          return (
            <section
              key={assignment.id}
              className="overflow-hidden rounded-xl border border-line bg-white"
            >
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line bg-surface px-5 py-4">
                <div className="flex min-w-0 items-start gap-3">
                  <span
                    className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                    style={{
                      background: `${TEAL}1a`,
                      color: TEAL,
                    }}
                  >
                    <Svg d={PATHS.file} size={18} />
                  </span>

                  <div>
                    <h5 className="text-base font-semibold leading-snug">
                      {config.title || "Module Assignment"}
                    </h5>

                    <p
                      className="mt-1 text-sm font-semibold"
                      style={{ color: TEAL }}
                    >
                      Maximum marks: {MAX_MARKS}
                    </p>
                  </div>
                </div>

                {deadline && (
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
                      deadline.past
                        ? "bg-red-50 text-red-700"
                        : "bg-amber-100 text-amber-900"
                    }`}
                  >
                    <Svg d={PATHS.clock} size={14} />
                    {deadline.past ? "Was due" : "Due"} {deadline.text}
                  </span>
                )}
              </div>

              <div className="space-y-4 px-5 py-5">
                {/* Section 1: Assignment instructions */}
                <button
                  type="button"
                  onClick={() =>
                    toggleSection(assignment.id, "instructions")
                  }
                  aria-expanded={
                    currentOpenSection === "instructions"
                  }
                  className="flex w-full items-center justify-between gap-3 rounded-lg border border-line px-4 py-3 text-left font-semibold hover:bg-surface"
                >
                  <span>
                    1. Assignment Questions &amp; Instructions
                  </span>

                  <span aria-hidden="true">
                    {currentOpenSection === "instructions" ? "−" : "+"}
                  </span>
                </button>

                {currentOpenSection === "instructions" && (
                  <div className="space-y-3 rounded-lg bg-surface p-4">
                    {assignment.prompt ? (
                      <div className="space-y-3 leading-7 text-muted">
                        {renderPrompt(assignment.prompt)}
                      </div>
                    ) : (
                      <p className="text-sm text-muted">
                        No instructions have been added yet.
                      </p>
                    )}

                    {config.file_path && (
                      <button
                        type="button"
                        onClick={() =>
                          void downloadAttachment(config.file_path!)
                        }
                        className="inline-flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-semibold transition-colors hover:bg-surface"
                        style={{
                          borderColor: TEAL,
                          color: TEAL,
                        }}
                      >
                        <Svg d={PATHS.download} />
                        Download attachment
                      </button>
                    )}
                  </div>
                )}

                {/* Section 2: Submission form */}
                <button
                  type="button"
                  onClick={() =>
                    toggleSection(assignment.id, "submit")
                  }
                  aria-expanded={currentOpenSection === "submit"}
                  className="flex w-full items-center justify-between gap-3 rounded-lg border border-line px-4 py-3 text-left font-semibold hover:bg-surface"
                >
                  <span>2. Submit Assignment</span>

                  <span aria-hidden="true">
                    {currentOpenSection === "submit" ? "−" : "+"}
                  </span>
                </button>

                {currentOpenSection === "submit" && (
                  <div className="space-y-4 rounded-lg bg-surface p-4">
                    {canResubmit ? (
                      <div>
                        <h6 className="font-semibold">
                          {submission?.review_status ===
                          "changes_requested"
                            ? "Resubmit corrected assignment"
                            : submission
                              ? "Submit a revised assignment"
                              : "Submit your assignment"}
                        </h6>

                        <p className="mt-1 text-sm text-muted">
                          This assignment is worth {MAX_MARKS} marks. Upload
                          your completed work. Maximum file size: 50 MB.
                        </p>

                        <input
                          id={`assignment-file-${assignment.id}`}
                          type="file"
                          disabled={isUploading}
                          onChange={(event) => {
                            const file =
                              event.target.files?.[0] ?? null;

                            setSelectedFiles((previous) => ({
                              ...previous,
                              [assignment.id]: file,
                            }));

                            setMessages((previous) => ({
                              ...previous,
                              [assignment.id]: "",
                            }));
                          }}
                          className="peer sr-only"
                        />

                        <label
                          htmlFor={`assignment-file-${assignment.id}`}
                          className={`mt-4 flex cursor-pointer items-center gap-4 rounded-xl border-2 border-dashed border-slate-300 bg-white px-5 py-5 transition-colors hover:border-[#0e7490] peer-focus-visible:border-[#0e7490] peer-focus-visible:ring-2 peer-focus-visible:ring-[#0e7490]/30 ${
                            isUploading
                              ? "pointer-events-none opacity-60"
                              : ""
                          }`}
                        >
                          <span
                            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface shadow-sm"
                            style={{ color: TEAL }}
                          >
                            <Svg d={PATHS.upload} size={20} />
                          </span>

                          <span className="min-w-0">
                            {selected ? (
                              <>
                                <span className="block truncate text-sm font-semibold">
                                  {selected.name}
                                </span>

                                <span className="block text-xs text-muted">
                                  {formatSize(selected.size)} · Click to
                                  choose a different file
                                </span>
                              </>
                            ) : (
                              <>
                                <span className="block text-sm font-semibold">
                                  Choose a file to upload
                                </span>

                                <span className="block text-xs text-muted">
                                  PDF, DOCX or another accepted file type
                                </span>
                              </>
                            )}
                          </span>
                        </label>

                        <button
                          type="button"
                          disabled={isUploading || !selected}
                          onClick={() =>
                            void submitAssignment(assignment)
                          }
                          className="mt-4 rounded-lg px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#0b5662] disabled:cursor-not-allowed disabled:opacity-50"
                          style={{ background: TEAL }}
                        >
                          {isUploading
                            ? "Submitting..."
                            : submission
                              ? "Submit revised assignment"
                              : "Submit assignment"}
                        </button>
                      </div>
                    ) : (
                      <p className="text-sm text-muted">
                        This assignment has been approved. No further
                        submission is available.
                      </p>
                    )}
                  </div>
                )}

                {/* Section 3: Grading and feedback */}
                <button
                  type="button"
                  onClick={() =>
                    toggleSection(assignment.id, "feedback")
                  }
                  aria-expanded={currentOpenSection === "feedback"}
                  className="flex w-full items-center justify-between gap-3 rounded-lg border border-line px-4 py-3 text-left font-semibold hover:bg-surface"
                >
                  <span>3. Grading &amp; Feedback</span>

                  <span aria-hidden="true">
                    {currentOpenSection === "feedback" ? "−" : "+"}
                  </span>
                </button>

                {currentOpenSection === "feedback" && (
                  <div className="rounded-lg bg-surface p-4">
                    {submission ? (
                      <section aria-label="Assignment review">
                        <h6 className="font-semibold">
                          Your submission and results
                        </h6>

                        <div className="mt-3">
                          <span
                            className={`inline-flex rounded-full px-3 py-1.5 text-sm font-semibold ${statusClasses(submission.review_status)}`}
                          >
                            {statusLabel(submission.review_status)}
                          </span>
                        </div>

                        {submission.score !== null ? (
                          <p className="mt-3 text-lg font-semibold">
                            Your marks: {submission.score}/{MAX_MARKS}
                          </p>
                        ) : (
                          <p className="mt-3 text-sm text-muted">
                            Your marks: Awaiting admin grading (out of{" "}
                            {MAX_MARKS})
                          </p>
                        )}

                        {submission.mentor_comment && (
                          <div className="mt-4 rounded-lg bg-white p-4">
                            <p className="text-sm font-semibold">
                              Feedback from your reviewer
                            </p>

                            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                              {submission.mentor_comment}
                            </p>
                          </div>
                        )}

                        {submission.review_status ===
                          "changes_requested" && (
                          <p className="mt-3 text-sm font-medium text-amber-800">
                            Please review the feedback above and upload a
                            corrected version in the Submit Assignment
                            section.
                          </p>
                        )}

                        {submission.review_status === "approved" && (
                          <p className="mt-3 text-sm text-emerald-800">
                            Your assignment has been approved.
                          </p>
                        )}
                      </section>
                    ) : (
                      <p className="text-sm text-muted">
                        Submit your assignment first. Your grading status,
                        marks, and reviewer feedback will appear here.
                      </p>
                    )}
                  </div>
                )}

                {/* Keep submission success/error visible when accordions close. */}
                {message && (
                  <p
                    role="status"
                    aria-live="polite"
                    className={`rounded-lg px-4 py-3 text-sm ${
                      isSuccess
                        ? "bg-emerald-50 text-emerald-800"
                        : "bg-amber-50 text-amber-900"
                    }`}
                  >
                    {message}
                  </p>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
