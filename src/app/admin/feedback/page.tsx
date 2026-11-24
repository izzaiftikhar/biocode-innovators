"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type FeedbackStatus = "pending" | "approved" | "rejected";
type Placement = "homepage" | "feedback_page" | "course_page";

type Feedback = {
  id: string;
  user_id: string;
  feedback_type: "platform" | "course";
  course_id: string | null;
  rating: number | null;
  content: string;
  display_name_preference: "first_name" | "custom" | "anonymous";
  custom_display_name: string | null;
  public_consent: boolean;
  status: FeedbackStatus;
  is_published: boolean;
  admin_edited_content: string | null;
  public_display_name: string | null;
  display_placement: Placement[];
  internal_note: string | null;
  reviewed_at: string | null;
  published_at: string | null;
  created_at: string;
  student_name: string;
  course_title: string | null;
};

type FeedbackDraft = {
  publicContent: string;
  publicName: string;
  internalNote: string;
  placements: Placement[];
};

type Filter = "all" | "pending" | "approved" | "rejected" | "published";

const sectionClass = "rounded-2xl border border-current/10 p-5 md:p-6";

const inputClass =
  "mt-2 w-full rounded-xl border border-current/15 bg-transparent px-3.5 py-3 font-normal outline-none focus:border-current/40";

const placementOptions: { value: Placement; label: string }[] = [
  { value: "homepage", label: "Homepage" },
  { value: "feedback_page", label: "Feedback page" },
  { value: "course_page", label: "Course page" },
];

export default function AdminFeedback() {
  const [feedback, setFeedback] = useState<Feedback[]>([]);
  const [drafts, setDrafts] = useState<Record<string, FeedbackDraft>>({});
  const [filter, setFilter] = useState<Filter>("pending");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadFeedback = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/admin/feedback", {
        method: "GET",
        cache: "no-store",
      });

      const result = await response.json().catch(() => null);

      if (!response.ok || !result || !Array.isArray(result.feedback)) {
        setError(result?.error || "Could not load feedback submissions.");
        setFeedback([]);
        return;
      }

      const rows = result.feedback as Feedback[];
      setFeedback(rows);

      setDrafts((current) => {
        const next = { ...current };

        for (const row of rows) {
          if (!next[row.id]) {
            next[row.id] = {
              publicContent: row.admin_edited_content ?? row.content,
              publicName: row.public_display_name ?? "",
              internalNote: row.internal_note ?? "",
              placements: row.display_placement ?? ["feedback_page"],
            };
          }
        }

        return next;
      });
    } catch {
      setError("An unexpected error occurred while loading feedback.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadFeedback();
  }, [loadFeedback]);

  const counts = useMemo(
    () => ({
      all: feedback.length,
      pending: feedback.filter((item) => item.status === "pending").length,
      approved: feedback.filter((item) => item.status === "approved").length,
      rejected: feedback.filter((item) => item.status === "rejected").length,
      published: feedback.filter((item) => item.is_published).length,
    }),
    [feedback],
  );

  const filteredFeedback = useMemo(() => {
    return feedback.filter((item) => {
      const matchesFilter =
        filter === "all" ||
        (filter === "published"
          ? item.is_published
          : item.status === filter);

      const draft = drafts[item.id];

      const searchableText = [
        item.student_name,
        item.course_title ?? "",
        item.feedback_type,
        item.content,
        item.status,
        item.user_id,
      ]
        .join(" ")
        .toLowerCase();

      const matchesSearch = searchableText.includes(search.toLowerCase());

      return matchesFilter && matchesSearch;
    });
  }, [feedback, drafts, filter, search]);

  function updateDraft(
    id: string,
    field: keyof FeedbackDraft,
    value: string | Placement[],
  ) {
    setDrafts((current) => ({
      ...current,
      [id]: {
        publicContent: current[id]?.publicContent ?? "",
        publicName: current[id]?.publicName ?? "",
        internalNote: current[id]?.internalNote ?? "",
        placements: current[id]?.placements ?? [],
        [field]: value,
      },
    }));
  }

  function togglePlacement(id: string, placement: Placement) {
    const current = drafts[id]?.placements ?? [];

    const next = current.includes(placement)
      ? current.filter((item) => item !== placement)
      : [...current, placement];

    updateDraft(id, "placements", next);
  }

  async function saveModeration(
    item: Feedback,
    changes: {
      status?: FeedbackStatus;
      isPublished?: boolean;
    } = {},
  ) {
    const draft = drafts[item.id];

    if (!draft) return;

    setError("");
    setMessage("");

    if (changes.isPublished === true && !item.public_consent) {
      setError("This student has not consented to public display.");
      return;
    }

    if (changes.isPublished === true && (changes.status ?? item.status) !== "approved") {
      setError("Approve this feedback before publishing it.");
      return;
    }

    if (changes.isPublished === true && !draft.publicContent.trim()) {
      setError("Add public feedback text before publishing.");
      return;
    }

    if (
      changes.isPublished === true &&
      (draft.publicContent.trim().length < 10 ||
        draft.publicContent.trim().length > 2000)
    ) {
      setError("Public feedback must be between 10 and 2,000 characters.");
      return;
    }

    if (
      changes.isPublished === true &&
      draft.placements.length === 0
    ) {
      setError("Choose at least one display placement before publishing.");
      return;
    }

    if (
      item.feedback_type === "platform" &&
      draft.placements.includes("course_page")
    ) {
      setError("Platform feedback cannot appear on a course page.");
      return;
    }

    if (
      draft.publicName.trim() &&
      (draft.publicName.trim().length < 2 ||
        draft.publicName.trim().length > 60)
    ) {
      setError("Public display name must be between 2 and 60 characters.");
      return;
    }

    setSavingId(item.id);

    try {
      const response = await fetch("/api/admin/feedback", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: item.id,
          status: changes.status ?? item.status,
          isPublished:
            changes.isPublished === undefined
              ? item.is_published
              : changes.isPublished,
          adminEditedContent: draft.publicContent.trim(),
          publicDisplayName: draft.publicName.trim() || undefined,
          internalNote: draft.internalNote,
          displayPlacement: draft.placements,
        }),
      });

      const result = await response.json().catch(() => null);

      if (!response.ok || !result?.feedback) {
        setError(result?.error || "Could not save moderation changes.");
        return;
      }

      const updated = result.feedback as Partial<Feedback>;

      setFeedback((current) =>
        current.map((row) =>
          row.id === item.id
            ? {
                ...row,
                ...updated,
              }
            : row,
        ),
      );

      setDrafts((current) => ({
        ...current,
        [item.id]: {
          publicContent:
            updated.admin_edited_content ?? draft.publicContent,
          publicName:
            updated.public_display_name ?? draft.publicName,
          internalNote:
            updated.internal_note ?? draft.internalNote,
          placements:
            updated.display_placement ?? draft.placements,
        },
      }));

      setMessage(result.message || "Moderation changes saved.");
    } catch {
      setError("An unexpected error occurred while saving feedback.");
    } finally {
      setSavingId(null);
    }
  }

  function formatDate(value: string | null) {
    if (!value) return "Not available";

    const date = new Date(value);

    return Number.isNaN(date.getTime())
      ? "Not available"
      : date.toLocaleString();
  }

  function statusLabel(item: Feedback) {
    if (item.is_published) return "Published";
    return item.status.replaceAll("_", " ");
  }

  return (
    <main className="container-page py-10 md:py-14">
      <header className="mb-9">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-muted">
          BioCode Innovators · Community
        </p>

        <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
          Student Feedback
        </h1>

        <p className="mt-3 max-w-2xl text-muted">
          Review student experiences, prepare public versions, and decide
          whether approved feedback should appear on the website.
        </p>
      </header>

      <section className={`${sectionClass} mb-6`}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">Feedback overview</h2>
            <p className="mt-1 text-sm text-muted">
              {counts.all} total submissions
            </p>
          </div>

          <button
            type="button"
            onClick={() => void loadFeedback()}
            disabled={loading}
            className="rounded-xl border border-current/15 px-4 py-2.5 text-sm transition hover:bg-current/5 disabled:opacity-50"
          >
            {loading ? "Refreshing..." : "Refresh list"}
          </button>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-5">
          {(
            [
              ["all", "All"],
              ["pending", "Pending"],
              ["approved", "Approved"],
              ["rejected", "Rejected"],
              ["published", "Published"],
            ] as [Filter, string][]
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setFilter(value)}
              aria-pressed={filter === value}
              className={`rounded-xl border p-3 text-left transition ${
                filter === value
                  ? "border-cyan-500/50 bg-cyan-500/10"
                  : "border-current/10 hover:bg-current/5"
              }`}
            >
              <span className="block text-xl font-semibold tabular-nums">
                {counts[value]}
              </span>
              <span className="mt-1 block text-xs text-muted">{label}</span>
            </button>
          ))}
        </div>

        <label className="mt-5 block text-sm font-medium">
          Search feedback

          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Student, course, feedback text, or status"
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
        <p className="py-10 text-muted">Loading feedback submissions...</p>
      ) : filteredFeedback.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-current/20 p-8 text-center">
          <h2 className="font-semibold">No feedback found</h2>
          <p className="mt-2 text-sm text-muted">
            {feedback.length === 0
              ? "Student feedback submissions will appear here."
              : "Try another filter or search term."}
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {filteredFeedback.map((item) => {
            const draft = drafts[item.id];
            const isSaving = savingId === item.id;

            if (!draft) return null;

            const canPublish =
              item.public_consent && item.status === "approved";

            return (
              <article key={item.id} className={sectionClass}>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full border border-current/15 px-3 py-1 text-xs capitalize">
                        {item.feedback_type} feedback
                      </span>

                      <span className="rounded-full border border-current/15 px-3 py-1 text-xs capitalize">
                        {statusLabel(item)}
                      </span>
                    </div>

                    <h2 className="mt-3 text-lg font-semibold">
                      {item.student_name || "Unknown student"}
                    </h2>

                    {item.course_title && (
                      <p className="mt-1 text-sm text-muted">
                        Course: {item.course_title}
                      </p>
                    )}

                    <p className="mt-1 break-all text-xs text-muted">
                      Submission ID: {item.id}
                    </p>

                    <p className="mt-1 text-xs text-muted">
                      Submitted: {formatDate(item.created_at)}
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="text-sm font-medium">
                      {item.rating ? `${item.rating}/5 stars` : "No rating"}
                    </p>
                    <p className="mt-1 text-xs text-muted">
                      {item.is_published
                        ? `Published ${formatDate(item.published_at)}`
                        : "Not published"}
                    </p>
                  </div>
                </div>

                <div className="mt-5 rounded-xl border border-current/10 p-4">
                  <h3 className="text-sm font-semibold">
                    Original student feedback
                  </h3>
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-7">
                    {item.content}
                  </p>
                </div>

                <div className="mt-4 rounded-xl border border-current/10 p-4">
                  <h3 className="text-sm font-semibold">
                    Publication consent
                  </h3>

                  <p className="mt-2 text-sm text-muted">
                    {item.public_consent
                      ? "The student has explicitly consented to public display."
                      : "The student has NOT consented to public display. This submission must remain private."}
                  </p>

                  <p className="mt-2 text-xs text-muted">
                    Name preference:{" "}
                    {item.display_name_preference.replaceAll("_", " ")}
                  </p>
                </div>

                <div className="mt-6 space-y-5 border-t border-current/10 pt-5">
                  <div>
                    <h3 className="font-semibold">Public version</h3>
                    <p className="mt-1 text-xs text-muted">
                      Edit the wording that visitors will see. The original
                      student submission remains unchanged.
                    </p>

                    <label className="mt-4 block text-sm font-medium">
                      Public feedback text

                      <textarea
                        rows={5}
                        maxLength={2000}
                        value={draft.publicContent}
                        onChange={(event) =>
                          updateDraft(
                            item.id,
                            "publicContent",
                            event.target.value,
                          )
                        }
                        disabled={isSaving}
                        className={inputClass}
                        placeholder="Prepare the public version of this feedback..."
                      />
                    </label>

                    <p className="mt-1 text-right text-xs text-muted">
                      {draft.publicContent.length}/2000
                    </p>
                  </div>

                  <label className="block text-sm font-medium">
                    Public display name

                    <input
                      value={draft.publicName}
                      onChange={(event) =>
                        updateDraft(item.id, "publicName", event.target.value)
                      }
                      disabled={isSaving}
                      maxLength={60}
                      className={inputClass}
                      placeholder={
                        item.display_name_preference === "anonymous"
                          ? "Anonymous student"
                          : item.display_name_preference === "custom"
                            ? item.custom_display_name ?? "Custom name"
                            : "Leave blank to use the student's first name"
                      }
                    />

                    <span className="mt-1 block text-xs font-normal text-muted">
                      Leave blank to use the student's selected name preference.
                    </span>
                  </label>

                  <div>
                    <h3 className="text-sm font-semibold">
                      Display placement
                    </h3>

                    <div className="mt-3 flex flex-wrap gap-4">
                      {placementOptions.map((option) => {
                        const disabled =
                          isSaving ||
                          (option.value === "course_page" &&
                            item.feedback_type !== "course");

                        return (
                          <label
                            key={option.value}
                            className={`flex items-center gap-2 text-sm ${
                              disabled ? "opacity-50" : ""
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={draft.placements.includes(option.value)}
                              onChange={() =>
                                togglePlacement(item.id, option.value)
                              }
                              disabled={disabled}
                              className="h-4 w-4 accent-cyan-500"
                            />
                            {option.label}
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  <label className="block text-sm font-medium">
                    Private admin note

                    <textarea
                      rows={3}
                      value={draft.internalNote}
                      onChange={(event) =>
                        updateDraft(item.id, "internalNote", event.target.value)
                      }
                      disabled={isSaving}
                      className={inputClass}
                      placeholder="Internal note for the admin team. Never shown publicly."
                    />
                  </label>

                  <div className="flex flex-wrap gap-3 border-t border-current/10 pt-5">
                    <button
                      type="button"
                      onClick={() => void saveModeration(item)}
                      disabled={isSaving}
                      className="rounded-xl border border-current/15 px-4 py-3 text-sm font-semibold transition hover:bg-current/5 disabled:opacity-50"
                    >
                      {isSaving ? "Saving..." : "Save changes"}
                    </button>

                    {item.status !== "approved" && (
                      <button
                        type="button"
                        onClick={() =>
                          void saveModeration(item, {
                            status: "approved",
                            isPublished: false,
                          })
                        }
                        disabled={isSaving}
                        className="rounded-xl bg-cyan-200 px-4 py-3 text-sm font-semibold text-slate-900 transition hover:bg-cyan-300 disabled:opacity-50"
                      >
                        Approve privately
                      </button>
                    )}

                    {item.status !== "rejected" && (
                      <button
                        type="button"
                        onClick={() =>
                          void saveModeration(item, {
                            status: "rejected",
                            isPublished: false,
                          })
                        }
                        disabled={isSaving}
                        className="rounded-xl border border-red-500/40 px-4 py-3 text-sm font-semibold transition hover:bg-red-500/10 disabled:opacity-50"
                      >
                        Reject
                      </button>
                    )}

                    {canPublish && !item.is_published && (
                      <button
                        type="button"
                        onClick={() =>
                          void saveModeration(item, {
                            status: "approved",
                            isPublished: true,
                          })
                        }
                        disabled={isSaving}
                        className="rounded-xl bg-cyan-200 px-4 py-3 text-sm font-semibold text-slate-900 transition hover:bg-cyan-300 disabled:opacity-50"
                      >
                        Publish feedback
                      </button>
                    )}

                    {item.is_published && (
                      <button
                        type="button"
                        onClick={() =>
                          void saveModeration(item, {
                            status: "approved",
                            isPublished: false,
                          })
                        }
                        disabled={isSaving}
                        className="rounded-xl border border-amber-500/50 px-4 py-3 text-sm font-semibold transition hover:bg-amber-500/10 disabled:opacity-50"
                      >
                        Unpublish
                      </button>
                    )}
                  </div>

                  {!item.public_consent && (
                    <p className="text-xs text-muted">
                      Publishing controls are unavailable because public
                      consent was not granted.
                    </p>
                  )}
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
