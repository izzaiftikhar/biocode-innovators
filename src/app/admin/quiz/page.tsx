
"use client";

import { useCallback, useEffect, useState } from "react";

type Course = { id: string; title: string };

type Question = {
  id: string;
  position: number;
  prompt: string;
  options: string[];
  correct_index: number;
};

type DraftQuestion = {
  id: number;
  prompt: string;
  options: string[];
  correct: number;
};

type Attempt = {
  id: string;
  name: string;
  attempt_number: number;
  score: number;
  total: number;
  percent: number;
  passed: boolean;
  created_at: string;
};

type RetakeRequest = {
  id: string;
  attempt_id: string;
  name: string;
  reason: string;
  status: "pending" | "approved" | "rejected";
  requested_at: string;
  reviewed_at: string | null;
  admin_note: string | null;
  approved_attempt_number: number | null;
  consumed_at: string | null;
};

const sectionClass = "rounded-2xl border border-current/10 p-5 md:p-6";
const inputClass =
  "mt-2 w-full rounded-xl border border-current/15 bg-transparent px-3.5 py-3 font-normal outline-none focus:border-current/40";
const EMPTY_OPTIONS = ["", "", "", ""];

export default function AdminQuiz() {
  async function api<T = Record<string, unknown>>(
    url: string,
    init?: RequestInit
  ): Promise<{ ok: boolean; data: T & { error?: string } }> {
    try {
      const res = await fetch(url, init);
      const data = (await res.json().catch(() => ({}))) as T & {
        error?: string;
      };
      return { ok: res.ok, data };
    } catch {
      return {
        ok: false,
        data: {
          error: "Network error. Please try again.",
        } as T & { error?: string },
      };
    }
  }

  function post(payload: Record<string, unknown>) {
    return api("/api/admin/quiz", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ courseId, ...payload }),
    });
  }

  const [courses, setCourses] = useState<Course[]>([]);
  const [courseId, setCourseId] = useState("");
  const [published, setPublished] = useState(false);
  const [passPercent, setPassPercent] = useState("90");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [requests, setRequests] = useState<RetakeRequest[]>([]);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [prompt, setPrompt] = useState("");
  const [options, setOptions] = useState<string[]>(EMPTY_OPTIONS);
  const [correct, setCorrect] = useState(0);

  const [mcqCount, setMcqCount] = useState("10");
  const [drafts, setDrafts] = useState<DraftQuestion[]>([]);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    void api<{ courses: Course[] }>("/api/admin/quiz").then(({ ok, data }) => {
      if (!ok) setError(data.error || "Could not load courses.");
      setCourses(data.courses ?? []);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resetForm = useCallback(() => {
    setEditingId(null);
    setPrompt("");
    setOptions(EMPTY_OPTIONS);
    setCorrect(0);
  }, []);

  const loadCourse = useCallback(
    async (id: string) => {
      setError("");
      setMessage("");
      resetForm();

      if (!id) {
        setQuestions([]);
        setAttempts([]);
        setRequests([]);
        setDrafts([]);
        return;
      }

      const [quiz, history] = await Promise.all([
        api<{
          published: boolean;
          passPercent: number;
          questions: Question[];
        }>(`/api/admin/quiz?courseId=${encodeURIComponent(id)}`),

        api<{
          attempts: Attempt[];
          requests: RetakeRequest[];
        }>(`/api/admin/quiz-attempts?courseId=${encodeURIComponent(id)}`),
      ]);

      if (!quiz.ok) {
        setError(quiz.data.error || "Could not load the quiz.");
      }

      if (!history.ok) {
        setError(history.data.error || "Could not load quiz history.");
      }

      setPublished(!!quiz.data.published);
      setPassPercent(String(quiz.data.passPercent ?? 90));
      setQuestions(quiz.data.questions ?? []);
      setAttempts(history.data.attempts ?? []);
      setRequests(history.data.requests ?? []);
    },
    [resetForm]
  );

  function chooseCourse(id: string) {
    setCourseId(id);
    setDrafts([]);
    void loadCourse(id);
  }

  function generateDrafts() {
    const count = Number(mcqCount);

    setError("");
    setMessage("");

    if (!Number.isInteger(count) || count < 1 || count > 100) {
      setError("Choose a number between 1 and 100.");
      return;
    }

    const generated: DraftQuestion[] = Array.from(
      { length: count },
      (_, index) => ({
        id: Date.now() + index,
        prompt: "",
        options: [...EMPTY_OPTIONS],
        correct: 0,
      })
    );

    setDrafts((previous) => [...previous, ...generated]);
    setMessage(`${count} empty MCQ forms generated.`);
  }

  function updateDraft(id: number, changes: Partial<DraftQuestion>) {
    setDrafts((previous) =>
      previous.map((draft) =>
        draft.id === id ? { ...draft, ...changes } : draft
      )
    );
  }

  function updateDraftOption(id: number, optionIndex: number, value: string) {
    setDrafts((previous) =>
      previous.map((draft) =>
        draft.id === id
          ? {
              ...draft,
              options: draft.options.map((option, index) =>
                index === optionIndex ? value : option
              ),
            }
          : draft
      )
    );
  }

  async function saveSettings() {
    setError("");
    setMessage("");

    const pass = Number(passPercent);

    if (!Number.isInteger(pass) || pass < 1 || pass > 100) {
      return setError("The pass mark must be a whole number from 1 to 100.");
    }

    if (published && questions.length === 0) {
      return setError("Add at least one question before publishing the quiz.");
    }

    setBusy(true);
    const { ok, data } = await post({
      action: "save_settings",
      passPercent: pass,
      published,
    });
    setBusy(false);

    if (!ok) return setError(data.error || "Could not save the settings.");

    setMessage(
      published
        ? "Saved. The final quiz is live and required for the certificate."
        : "Saved. The quiz is hidden and not required for the certificate."
    );
  }

  async function saveQuestion() {
    setError("");
    setMessage("");

    if (!prompt.trim()) return setError("Write the question.");

    if (options.filter((option) => option.trim()).length < 2) {
      return setError("Enter at least two answer options.");
    }

    if (!options[correct]?.trim()) {
      return setError("Mark a correct answer with a non-empty option.");
    }

    setBusy(true);

    const { ok, data } = await post({
      action: editingId ? "update_question" : "create_question",
      questionId: editingId ?? undefined,
      prompt: prompt.trim(),
      options,
      correctIndex: correct,
    });

    setBusy(false);

    if (!ok) return setError(data.error || "Could not save the question.");

    setMessage(editingId ? "Question updated." : "Question added.");
    await loadCourse(courseId);
  }

  async function saveDraft(draft: DraftQuestion) {
    setError("");
    setMessage("");

    if (!draft.prompt.trim()) {
      return setError("Enter the question before saving it.");
    }

    if (draft.options.filter((option) => option.trim()).length < 2) {
      return setError("Enter at least two answer options.");
    }

    if (!draft.options[draft.correct]?.trim()) {
      return setError("Select a correct answer with a non-empty option.");
    }

    setBusy(true);

    const { ok, data } = await post({
      action: "create_question",
      prompt: draft.prompt.trim(),
      options: draft.options,
      correctIndex: draft.correct,
    });

    setBusy(false);

    if (!ok) return setError(data.error || "Could not save this question.");

    setDrafts((previous) =>
      previous.filter((item) => item.id !== draft.id)
    );

    setMessage("Question saved successfully.");
    await loadCourse(courseId);
  }

  function editQuestion(q: Question) {
    setEditingId(q.id);
    setPrompt(q.prompt);
    setOptions(
      [...q.options, "", "", "", ""].slice(0, Math.max(4, q.options.length))
    );
    setCorrect(q.correct_index);
    setMessage("");
    setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function deleteQuestion(q: Question) {
    if (!window.confirm("Delete this question?")) return;

    setBusy(true);
    const { ok, data } = await post({
      action: "delete_question",
      questionId: q.id,
    });
    setBusy(false);

    if (!ok) return setError(data.error || "Could not delete the question.");

    setMessage(
      data.unpublished
        ? "Question deleted. The quiz was unpublished because it has no questions left."
        : "Question deleted."
    );

    await loadCourse(courseId);
  }

  async function reviewRequest(
    request: RetakeRequest,
    decision: "approved" | "rejected"
  ) {
    const actionLabel = decision === "approved" ? "approve" : "reject";

    if (
      !window.confirm(
        `Are you sure you want to ${actionLabel} the retake request from ${request.name}?`
      )
    ) {
      return;
    }

    const adminNote = window.prompt(
      "Optional note for the student (leave blank if none):",
      ""
    );

    if (adminNote === null) return;

    setError("");
    setMessage("");
    setBusy(true);

    const { ok, data } = await api<{
      status?: string;
      message?: string;
    }>("/api/admin/quiz-attempts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requestId: request.id,
        decision,
        adminNote,
      }),
    });

    setBusy(false);

    if (!ok) {
      setError(data.error || "Could not review this request.");
      await loadCourse(courseId);
      return;
    }

    setMessage(data.message || `Request ${decision}.`);
    await loadCourse(courseId);
  }

  const pendingRequests = requests.filter(
    (request) => request.status === "pending"
  );

  return (
    <main className="container-page py-10 md:py-14">
      <h1 className="text-3xl font-semibold">Final quizzes</h1>

      <p className="mt-2 text-muted">
        Manage course quizzes, student attempts, and retake requests.
        Previous quiz results are preserved in the student's attempt history.
      </p>

      {error && (
        <p
          role="alert"
          className="mt-6 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          {error}
        </p>
      )}

      {message && (
        <p
          role="status"
          className="mt-6 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
        >
          {message}
        </p>
      )}

      <section className={`${sectionClass} mt-8`}>
        <label className="block text-sm font-medium">
          Course
          <select
            className={inputClass}
            value={courseId}
            onChange={(e) => chooseCourse(e.target.value)}
          >
            <option value="">Choose a course</option>
            {courses.map((course) => (
              <option key={course.id} value={course.id}>
                {course.title}
              </option>
            ))}
          </select>
        </label>

        {courseId && (
          <div className="mt-5 flex flex-wrap items-end gap-5">
            <label className="block text-sm font-medium">
              Pass mark (%)
              <input
                className={`${inputClass} w-32`}
                inputMode="numeric"
                value={passPercent}
                onChange={(e) => setPassPercent(e.target.value)}
              />
            </label>

            <label className="flex items-center gap-2 pb-3 text-sm font-medium">
              <input
                type="checkbox"
                checked={published}
                onChange={(e) => setPublished(e.target.checked)}
              />
              Published (required for the certificate)
            </label>

            <button
              type="button"
              className="btn disabled:opacity-60"
              disabled={busy}
              onClick={() => void saveSettings()}
            >
              Save settings
            </button>
          </div>
        )}
      </section>

      {courseId && (
        <>
          <section className={`${sectionClass} mt-8`}>
            <h2 className="text-xl font-semibold">Bulk MCQ generator</h2>

            <p className="mt-2 text-sm text-muted">
              Generate editable empty question forms and save each completed
              question individually.
            </p>

            <div className="mt-4 flex flex-wrap items-end gap-3">
              <label className="block text-sm font-medium">
                Number of MCQs
                <input
                  type="number"
                  min={1}
                  max={100}
                  className={`${inputClass} w-36`}
                  value={mcqCount}
                  onChange={(e) => setMcqCount(e.target.value)}
                />
              </label>

              <button
                type="button"
                className="btn disabled:opacity-60"
                disabled={busy}
                onClick={generateDrafts}
              >
                Generate MCQs
              </button>
            </div>
          </section>

          {drafts.map((draft, draftIndex) => (
            <section key={draft.id} className={`${sectionClass} mt-5`}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-semibold">
                  New question {draftIndex + 1}
                </h2>

                <button
                  type="button"
                  className="btn-outline"
                  disabled={busy}
                  onClick={() =>
                    setDrafts((previous) =>
                      previous.filter((item) => item.id !== draft.id)
                    )
                  }
                >
                  Remove
                </button>
              </div>

              <label className="mt-4 block text-sm font-medium">
                Question
                <textarea
                  className={inputClass}
                  rows={3}
                  placeholder="Write your MCQ question here..."
                  value={draft.prompt}
                  onChange={(e) =>
                    updateDraft(draft.id, { prompt: e.target.value })
                  }
                />
              </label>

              <p className="mt-4 text-sm font-medium">
                Answer options — select the correct answer
              </p>

              <div className="mt-3 space-y-3">
                {draft.options.map((option, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <input
                      type="radio"
                      name={`correct-${draft.id}`}
                      aria-label={`Option ${index + 1} is correct`}
                      checked={draft.correct === index}
                      onChange={() =>
                        updateDraft(draft.id, { correct: index })
                      }
                    />

                    <input
                      className="w-full rounded-xl border border-current/15 bg-transparent px-3.5 py-3 outline-none focus:border-current/40"
                      placeholder={`Option ${index + 1}`}
                      value={option}
                      onChange={(e) =>
                        updateDraftOption(draft.id, index, e.target.value)
                      }
                    />

                    {draft.options.length > 2 && (
                      <button
                        type="button"
                        className="text-sm text-red-600"
                        title="Remove option"
                        onClick={() => {
                          const nextOptions = draft.options.filter(
                            (_, i) => i !== index
                          );

                          const nextCorrect =
                            draft.correct === index
                              ? 0
                              : draft.correct > index
                                ? draft.correct - 1
                                : draft.correct;

                          updateDraft(draft.id, {
                            options: nextOptions,
                            correct: nextCorrect,
                          });
                        }}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {draft.options.length < 6 && (
                <button
                  type="button"
                  className="btn-outline mt-3"
                  onClick={() =>
                    updateDraft(draft.id, {
                      options: [...draft.options, ""],
                    })
                  }
                >
                  Add another option
                </button>
              )}

              <div className="mt-5">
                <button
                  type="button"
                  className="btn disabled:opacity-60"
                  disabled={busy}
                  onClick={() => void saveDraft(draft)}
                >
                  Save this question
                </button>
              </div>
            </section>
          ))}

          <section className={`${sectionClass} mt-8`}>
            <h2 className="text-xl font-semibold">
              {editingId ? "Edit question" : "Add a question manually"}
            </h2>

            <label className="mt-4 block text-sm font-medium">
              Question
              <textarea
                className={inputClass}
                rows={3}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
              />
            </label>

            <p className="mt-4 text-sm font-medium">
              Answer options (fill at least two) and select the correct one
            </p>

            <div className="mt-2 space-y-3">
              {options.map((option, index) => (
                <div key={index} className="flex items-center gap-3">
                  <input
                    type="radio"
                    name="correct"
                    aria-label={`Option ${index + 1} is correct`}
                    checked={correct === index}
                    onChange={() => setCorrect(index)}
                  />

                  <input
                    className="w-full rounded-xl border border-current/15 bg-transparent px-3.5 py-3 outline-none focus:border-current/40"
                    placeholder={`Option ${index + 1}`}
                    value={option}
                    onChange={(e) =>
                      setOptions((previous) =>
                        previous.map((item, i) =>
                          i === index ? e.target.value : item
                        )
                      )
                    }
                  />

                  {options.length > 2 && (
                    <button
                      type="button"
                      className="text-sm text-red-600"
                      onClick={() => {
                        setOptions((previous) =>
                          previous.filter((_, i) => i !== index)
                        );
                        setCorrect((previous) =>
                          previous === index
                            ? 0
                            : previous > index
                              ? previous - 1
                              : previous
                        );
                      }}
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}
            </div>

            {options.length < 6 && (
              <button
                type="button"
                className="btn-outline mt-3"
                onClick={() =>
                  setOptions((previous) => [...previous, ""])
                }
              >
                Add another option
              </button>
            )}

            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="button"
                className="btn disabled:opacity-60"
                disabled={busy}
                onClick={() => void saveQuestion()}
              >
                {editingId ? "Update question" : "Add question"}
              </button>

              {editingId && (
                <button
                  type="button"
                  className="btn-outline"
                  onClick={resetForm}
                >
                  Cancel edit
                </button>
              )}
            </div>
          </section>

          <section className={`${sectionClass} mt-8`}>
            <h2 className="text-xl font-semibold">
              Questions ({questions.length})
            </h2>

            {questions.length === 0 ? (
              <p className="mt-3 text-muted">No questions yet.</p>
            ) : (
              <ol className="mt-4 space-y-3">
                {questions.map((question, index) => (
                  <li
                    key={question.id}
                    className="rounded-xl border border-current/10 p-4"
                  >
                    <p className="font-semibold">
                      {index + 1}. {question.prompt}
                    </p>

                    <ul className="mt-2 space-y-1 text-sm">
                      {question.options.map((option, i) => (
                        <li
                          key={i}
                          className={
                            i === question.correct_index
                              ? "font-semibold text-green-700"
                              : "text-muted"
                          }
                        >
                          {i === question.correct_index ? "✓ " : "• "}
                          {option}
                        </li>
                      ))}
                    </ul>

                    <div className="mt-3 flex gap-2">
                      <button
                        type="button"
                        className="btn-outline"
                        onClick={() => editQuestion(question)}
                      >
                        Edit
                      </button>

                      <button
                        type="button"
                        className="btn-outline disabled:opacity-60"
                        disabled={busy}
                        onClick={() => void deleteQuestion(question)}
                      >
                        Delete
                      </button>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </section>

          <section className={`${sectionClass} mt-8`}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-xl font-semibold">
                Retake requests ({requests.length})
              </h2>
              <span className="text-sm font-medium text-amber-600">
                {pendingRequests.length} pending
              </span>
            </div>

            {requests.length === 0 ? (
              <p className="mt-3 text-sm text-muted">
                No retake requests have been submitted for this course.
              </p>
            ) : (
              <div className="mt-5 space-y-4">
                {requests.map((request) => (
                  <article
                    key={request.id}
                    className="rounded-xl border border-current/10 p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h3 className="font-semibold">{request.name}</h3>
                        <p className="mt-1 text-xs text-muted">
                          Requested{" "}
                          {new Date(request.requested_at).toLocaleString()}
                        </p>
                      </div>

                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          request.status === "pending"
                            ? "bg-amber-100 text-amber-800"
                            : request.status === "approved"
                              ? "bg-green-100 text-green-800"
                              : "bg-red-100 text-red-800"
                        }`}
                      >
                        {request.status.toUpperCase()}
                      </span>
                    </div>

                    <div className="mt-4">
                      <p className="text-sm font-medium">
                        Student's explanation
                      </p>
                      <p className="mt-2 whitespace-pre-wrap text-sm text-muted">
                        {request.reason}
                      </p>
                    </div>

                    {request.admin_note && (
                      <div className="mt-4 rounded-lg bg-current/5 p-3">
                        <p className="text-xs font-semibold">
                          Admin note
                        </p>
                        <p className="mt-1 whitespace-pre-wrap text-sm text-muted">
                          {request.admin_note}
                        </p>
                      </div>
                    )}

                    {request.status === "approved" && (
                      <p className="mt-3 text-sm text-green-700">
                        Approved attempt number:{" "}
                        {request.approved_attempt_number ?? "Pending"}
                        {request.consumed_at
                          ? " · New attempt started"
                          : " · Awaiting student"}
                      </p>
                    )}

                    {request.status === "pending" && (
                      <div className="mt-5 flex flex-wrap gap-3">
                        <button
                          type="button"
                          className="btn disabled:opacity-60"
                          disabled={busy}
                          onClick={() =>
                            void reviewRequest(request, "approved")
                          }
                        >
                          Approve request
                        </button>

                        <button
                          type="button"
                          className="btn-outline disabled:opacity-60"
                          disabled={busy}
                          onClick={() =>
                            void reviewRequest(request, "rejected")
                          }
                        >
                          Reject request
                        </button>
                      </div>
                    )}
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className={`${sectionClass} mt-8`}>
            <h2 className="text-xl font-semibold">
              Student attempt history ({attempts.length})
            </h2>

            {attempts.length === 0 ? (
              <p className="mt-3 text-muted">
                No one has taken this quiz yet.
              </p>
            ) : (
              <ul className="mt-4 space-y-3">
                {attempts.map((attempt) => (
                  <li
                    key={attempt.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-current/10 p-4"
                  >
                    <div>
                      <p className="font-semibold">{attempt.name}</p>

                      <p className="mt-1 text-sm text-muted">
                        Attempt #{attempt.attempt_number} · {attempt.percent}%
                        {" · "}
                        {attempt.score} of {attempt.total}
                      </p>

                      <p className="text-xs text-muted">
                        {new Date(attempt.created_at).toLocaleString()}
                      </p>

                      <p
                        className={`mt-1 text-sm font-semibold ${
                          attempt.passed
                            ? "text-green-700"
                            : "text-red-700"
                        }`}
                      >
                        {attempt.passed ? "Passed" : "Did not pass"}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </main>
  );
}
