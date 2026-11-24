
"use client";

import { useCallback, useEffect, useState } from "react";

type Entry = {
  id: string;
  topic: string;
  answer: string;
  link_href: string | null;
  link_label: string | null;
  is_published: boolean;
  updated_at: string;
};

type UnansweredQuestion = {
  id: string;
  question: string;
  status: "pending" | "reviewed" | "resolved" | "dismissed";
  answer: string | null;
  created_at: string;
  reviewed_at: string | null;
};

const sectionClass = "rounded-2xl border border-current/10 p-5 md:p-6";
const inputClass =
  "mt-2 w-full rounded-xl border border-current/15 bg-transparent px-3.5 py-3 font-normal outline-none focus:border-current/40";

const SUGGESTIONS = [
  "Is the community online or onsite?",
  "Who can join the community, and is it free?",
  "Fellowship eligibility and duration",
  "Fellowship benefits and requirements",
  "How to apply for an internship",
  "How to get work into the Student Journal",
  "Where BioCode is based / office location",
  "Response time for contact messages",
  "Events, workshops and webinars",
  "Fees and payment for paid courses",
];

export default function AdminChatbotKnowledge() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [unanswered, setUnanswered] = useState<UnansweredQuestion[]>([]);
  const [answerDrafts, setAnswerDrafts] = useState<Record<string, string>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [topic, setTopic] = useState("");
  const [answer, setAnswer] = useState("");
  const [linkHref, setLinkHref] = useState("");
  const [linkLabel, setLinkLabel] = useState("");
  const [isPublished, setIsPublished] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/chatbot-knowledge");
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.error || "Could not load chatbot data.");
        return;
      }

      setEntries(data.entries ?? []);
      setUnanswered(data.unanswered ?? []);
      setError("");
    } catch {
      setError("Network error. Please try again.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function reset() {
    setEditingId(null);
    setTopic("");
    setAnswer("");
    setLinkHref("");
    setLinkLabel("");
    setIsPublished(true);
  }

  async function send(payload: Record<string, unknown>) {
    setBusy(true);
    setError("");
    setMessage("");

    try {
      const res = await fetch("/api/admin/chatbot-knowledge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.error || "Something went wrong.");
        return false;
      }

      return true;
    } catch {
      setError("Network error. Please try again.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (topic.trim().length < 3) {
      setError("Write a topic or question (at least 3 characters).");
      return;
    }

    if (answer.trim().length < 3) {
      setError("Write the answer.");
      return;
    }

    const ok = await send({
      action: "save",
      id: editingId ?? undefined,
      topic,
      answer,
      linkHref,
      linkLabel,
      isPublished,
    });

    if (!ok) return;

    setMessage(
      editingId
        ? "Entry updated. The chatbot will use it right away."
        : "Entry added. The chatbot will use it right away."
    );

    reset();
    await load();
  }

  async function remove(entry: Entry) {
    if (!window.confirm(`Delete "${entry.topic}"?`)) return;

    if (await send({ action: "delete", id: entry.id })) {
      setMessage("Entry deleted.");

      if (editingId === entry.id) reset();

      await load();
    }
  }

  async function togglePublished(entry: Entry) {
    const ok = await send({
      action: "save",
      id: entry.id,
      topic: entry.topic,
      answer: entry.answer,
      linkHref: entry.link_href ?? "",
      linkLabel: entry.link_label ?? "",
      isPublished: !entry.is_published,
    });

    if (ok) {
      setMessage(entry.is_published ? "Entry hidden." : "Entry published.");
      await load();
    }
  }

  function edit(entry: Entry) {
    setEditingId(entry.id);
    setTopic(entry.topic);
    setAnswer(entry.answer);
    setLinkHref(entry.link_href ?? "");
    setLinkLabel(entry.link_label ?? "");
    setIsPublished(entry.is_published);
    setError("");
    setMessage("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function resolveQuestion(question: UnansweredQuestion) {
    const approvedAnswer = (answerDrafts[question.id] ?? "").trim();

    if (approvedAnswer.length < 3) {
      setError("Write a verified answer before publishing it.");
      return;
    }

    if (approvedAnswer.length > 2000) {
      setError("The answer must be 2000 characters or fewer.");
      return;
    }

    const ok = await send({
      action: "resolveQuestion",
      questionId: question.id,
      answer: approvedAnswer,
      linkHref: "",
      linkLabel: "",
    });

    if (!ok) return;

    setMessage("Verified answer published to chatbot knowledge.");
    setAnswerDrafts((previous) => {
      const next = { ...previous };
      delete next[question.id];
      return next;
    });

    await load();
  }

  async function dismissQuestion(question: UnansweredQuestion) {
    if (!window.confirm("Dismiss this question without publishing an answer?")) {
      return;
    }

    if (
      await send({
        action: "dismissQuestion",
        questionId: question.id,
      })
    ) {
      setMessage("Question dismissed.");
      await load();
    }
  }

  const pendingQuestions = unanswered.filter(
    (question) => question.status === "pending" || question.status === "reviewed"
  );

  return (
    <main className="container-page py-10 md:py-14">
      <h1 className="text-3xl font-semibold">Chatbot knowledge</h1>
      <p className="mt-2 max-w-2xl text-muted">
        Manage verified BioCode facts and review questions the chatbot could not
        answer. Published answers can be used by the website chatbot.
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
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold">Unanswered questions</h2>
            <p className="mt-1 text-sm text-muted">
              Check each question and publish only an answer you can verify.
            </p>
          </div>
          <span className="rounded-full border border-current/15 px-3 py-1 text-sm">
            {pendingQuestions.length} to review
          </span>
        </div>

        {pendingQuestions.length === 0 ? (
          <p className="mt-4 text-sm text-muted">
            No questions are waiting for review.
          </p>
        ) : (
          <ul className="mt-4 space-y-4">
            {pendingQuestions.map((question) => (
              <li
                key={question.id}
                className="rounded-xl border border-current/10 p-4 md:p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="font-semibold">{question.question}</p>
                  <span className="rounded-full border border-current/15 px-2.5 py-1 text-xs">
                    {question.status === "reviewed" ? "Reviewed" : "Pending"}
                  </span>
                </div>

                <p className="mt-2 text-xs text-muted">
                  Received{" "}
                  {new Date(question.created_at).toLocaleString()}
                </p>

                <label className="mt-4 block text-sm font-medium">
                  Verified answer
                  <textarea
                    className={inputClass}
                    rows={4}
                    maxLength={2000}
                    value={answerDrafts[question.id] ?? ""}
                    onChange={(event) =>
                      setAnswerDrafts((previous) => ({
                        ...previous,
                        [question.id]: event.target.value,
                      }))
                    }
                    placeholder="Write the correct answer. If you cannot verify it, dismiss the question instead."
                  />
                </label>

                <p className="mt-1 text-xs text-muted">
                  {(answerDrafts[question.id] ?? "").length}/2000 characters
                </p>

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="btn disabled:opacity-60"
                    disabled={busy}
                    onClick={() => void resolveQuestion(question)}
                  >
                    Publish answer
                  </button>

                  <button
                    type="button"
                    className="btn-outline disabled:opacity-60"
                    disabled={busy}
                    onClick={() => void dismissQuestion(question)}
                  >
                    Dismiss question
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {unanswered.some(
          (question) =>
            question.status === "resolved" || question.status === "dismissed"
        ) && (
          <details className="mt-5">
            <summary className="cursor-pointer text-sm font-medium">
              Previously handled questions
            </summary>
            <ul className="mt-3 space-y-2">
              {unanswered
                .filter(
                  (question) =>
                    question.status === "resolved" ||
                    question.status === "dismissed"
                )
                .map((question) => (
                  <li
                    key={question.id}
                    className="rounded-lg border border-current/10 p-3"
                  >
                    <p className="font-medium">{question.question}</p>
                    <p className="mt-1 text-xs text-muted">
                      {question.status === "resolved"
                        ? "Answered and published"
                        : "Dismissed"}
                    </p>
                    {question.answer && (
                      <p className="mt-2 whitespace-pre-wrap text-sm text-muted">
                        {question.answer}
                      </p>
                    )}
                  </li>
                ))}
            </ul>
          </details>
        )}

        <button
          type="button"
          className="btn-outline mt-4 disabled:opacity-60"
          disabled={busy}
          onClick={() => void load()}
        >
          Refresh questions
        </button>
      </section>

      <section className={`${sectionClass} mt-8`}>
        <h2 className="text-xl font-semibold">
          {editingId ? "Edit entry" : "Add an entry"}
        </h2>

        {!editingId && (
          <div className="mt-4">
            <p className="text-sm font-medium">
              Quick start: pick a topic, then write the answer
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {SUGGESTIONS.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => setTopic(suggestion)}
                  className="rounded-full border border-current/15 px-3 py-1.5 text-sm hover:border-current/40"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        <label className="mt-5 block text-sm font-medium">
          Topic or question
          <input
            className={inputClass}
            maxLength={150}
            value={topic}
            onChange={(event) => setTopic(event.target.value)}
            placeholder="e.g. Is the community online or onsite?"
          />
        </label>

        <label className="mt-4 block text-sm font-medium">
          Answer
          <textarea
            className={inputClass}
            rows={5}
            maxLength={2000}
            value={answer}
            onChange={(event) => setAnswer(event.target.value)}
            placeholder="Write the correct, approved answer in full sentences."
          />
        </label>
        <p className="mt-1 text-xs text-muted">{answer.length}/2000</p>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-medium">
            Link (optional)
            <input
              className={inputClass}
              value={linkHref}
              onChange={(event) => setLinkHref(event.target.value)}
              placeholder="/community or https://example.com"
            />
          </label>
          <label className="block text-sm font-medium">
            Link label
            <input
              className={inputClass}
              maxLength={60}
              value={linkLabel}
              onChange={(event) => setLinkLabel(event.target.value)}
              placeholder="Visit the community page"
            />
          </label>
        </div>

        <label className="mt-4 flex items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            checked={isPublished}
            onChange={(event) => setIsPublished(event.target.checked)}
          />
          Published (the chatbot can use it)
        </label>

        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            className="btn disabled:opacity-60"
            disabled={busy}
            onClick={() => void save()}
          >
            {editingId ? "Update entry" : "Add entry"}
          </button>

          {(editingId || topic || answer) && (
            <button type="button" className="btn-outline" onClick={reset}>
              Clear
            </button>
          )}
        </div>
      </section>

      <section className={`${sectionClass} mt-8`}>
        <h2 className="text-xl font-semibold">Entries ({entries.length})</h2>

        {entries.length === 0 ? (
          <p className="mt-3 text-muted">
            No entries yet. Add the first one above.
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            {entries.map((entry) => (
              <li
                key={entry.id}
                className="rounded-xl border border-current/10 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold">{entry.topic}</p>
                    <p
                      className={`text-xs font-semibold ${
                        entry.is_published ? "text-green-700" : "text-muted"
                      }`}
                    >
                      {entry.is_published ? "Published" : "Hidden"}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="btn-outline disabled:opacity-60"
                      disabled={busy}
                      onClick={() => edit(entry)}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="btn-outline disabled:opacity-60"
                      disabled={busy}
                      onClick={() => void togglePublished(entry)}
                    >
                      {entry.is_published ? "Hide" : "Publish"}
                    </button>
                    <button
                      type="button"
                      className="btn-outline disabled:opacity-60"
                      disabled={busy}
                      onClick={() => void remove(entry)}
                    >
                      Delete
                    </button>
                  </div>
                </div>

                <p className="mt-2 whitespace-pre-wrap text-sm text-muted">
                  {entry.answer}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
