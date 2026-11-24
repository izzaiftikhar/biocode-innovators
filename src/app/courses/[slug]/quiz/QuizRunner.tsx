
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";

type Question = {
  id: string;
  prompt: string;
  options: string[];
};

type Result = {
  score: number;
  total: number;
  percent: number;
  passed: boolean;
  passPercent: number;
};

type SessionData = {
  status?: string;
  currentIndex?: number;
  current_index?: number;
  total?: number;
  remainingSeconds?: number;
  remaining_seconds?: number;
  question?: Question;
  result?: {
    score?: number;
    total?: number;
    percent?: number;
    passed?: boolean;
    passPercent?: number;
    pass_percent?: number;
  };
  score?: number;
  percent?: number;
  passed?: boolean;
  passPercent?: number;
  pass_percent?: number;
  error?: string;
};

type Phase = "loading" | "ready" | "active" | "result";

export default function QuizRunner({
  courseId,
  passPercent,
  questionCount,
}: {
  courseId: string;
  passPercent: number;
  questionCount: number;
}) {
  const [phase, setPhase] = useState<Phase>("loading");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [remainingSeconds, setRemainingSeconds] = useState(60);
  const [question, setQuestion] = useState<Question | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Result | null>(null);

  const requestInProgress = useRef(false);
  const answerInProgress = useRef(false);
  const deadlineRef = useRef(0);
  const lastSyncRef = useRef(0);

  const applyResult = useCallback(
    (data: SessionData) => {
      const resultData = data.result ?? data;

      if (
        typeof resultData.score !== "number" ||
        typeof resultData.total !== "number" ||
        typeof resultData.percent !== "number" ||
        typeof resultData.passed !== "boolean"
      ) {
        setError(
          "The quiz result could not be loaded. Please refresh the page.",
        );
        return;
      }

      setResult({
        score: resultData.score,
        total: resultData.total,
        percent: resultData.percent,
        passed: resultData.passed,
        passPercent:
          resultData.passPercent ??
          resultData.pass_percent ??
          passPercent,
      });

      deadlineRef.current = 0;
      setPhase("result");
      setQuestion(null);
      setSelectedAnswer(null);
      setError("");
      setBusy(false);
    },
    [passPercent],
  );

  const applySession = useCallback(
    (data: SessionData) => {
      if (data.status === "completed") {
        applyResult(data);
        return;
      }

      if (
        data.status === "not_started" ||
        data.status === "not_found"
      ) {
        setPhase("ready");
        setQuestion(null);
        setSelectedAnswer(null);
        deadlineRef.current = 0;
        return;
      }

      if (
        (data.status === "active" || data.status === "advanced") &&
        data.question
      ) {
        const nextIndex =
          data.currentIndex ?? data.current_index ?? 0;

        const seconds = Math.max(
          0,
          data.remainingSeconds ?? data.remaining_seconds ?? 60,
        );

        setCurrentIndex(nextIndex);
        setRemainingSeconds(seconds);
        setQuestion(data.question);
        setSelectedAnswer(null);

        deadlineRef.current = Date.now() + seconds * 1000;
        lastSyncRef.current = 0;

        setPhase("active");
        setError("");
        return;
      }

      if (data.status === "expired") {
        setRemainingSeconds(0);
        setError("The question has expired. Synchronizing your quiz...");
        return;
      }

      setError(data.error || "Could not load your quiz session.");
    },
    [applyResult],
  );

  const loadSession = useCallback(async () => {
    if (requestInProgress.current) return;

    requestInProgress.current = true;

    try {
      const response = await fetch(
        `/api/quiz/session?courseId=${encodeURIComponent(courseId)}`,
        { cache: "no-store" },
      );

      const data = (await response.json()) as SessionData;

      if (!response.ok) {
        setError(data.error || "Could not load your quiz session.");
        return;
      }

      applySession(data);
    } catch {
      setError("Could not connect. Checking your session again...");
    } finally {
      requestInProgress.current = false;
    }
  }, [courseId, applySession]);

  useEffect(() => {
    void loadSession();
  }, [loadSession]);

  const startQuiz = async () => {
    if (busy) return;

    setBusy(true);
    setError("");

    try {
      const response = await fetch("/api/quiz/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseId }),
      });

      const data = (await response.json()) as SessionData;

      if (!response.ok) {
        setError(data.error || "Could not start the quiz.");
        return;
      }

      // A new attempt starts, or an existing active attempt resumes.
      setResult(null);
      applySession(data);
    } catch {
      setError("Could not connect. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const submitAnswer = async () => {
    if (
      !question ||
      selectedAnswer === null ||
      busy ||
      answerInProgress.current ||
      phase !== "active" ||
      remainingSeconds <= 0
    ) {
      return;
    }

    answerInProgress.current = true;
    setBusy(true);
    setError("");

    try {
      const response = await fetch("/api/quiz/answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseId,
          questionIndex: currentIndex,
          answerIndex: selectedAnswer,
        }),
      });

      const data = (await response.json()) as SessionData;

      // The server has moved to the next question.
      if (
        response.status === 409 &&
        data.status === "advanced"
      ) {
        applySession(data);
        return;
      }

      // The last submitted answer completed the quiz.
      if (data.status === "completed") {
        applyResult(data);
        return;
      }

      if (!response.ok) {
        setError(data.error || "Your answer could not be confirmed.");

        if (response.status === 409 || response.status >= 500) {
          await loadSession();
        }

        return;
      }

      if (data.status === "saved") {
        // Compatibility fallback for an older database function.
        await loadSession();
        return;
      }

      setError(
        "Your answer could not be confirmed. Please synchronize your session.",
      );
      await loadSession();
    } catch {
      setError(
        "The submission response was interrupted. Checking your saved session...",
      );
      await loadSession();
    } finally {
      answerInProgress.current = false;
      setBusy(false);
    }
  };

  // The displayed countdown follows the server-provided deadline.
  // The server remains authoritative when a question expires.
  useEffect(() => {
    if (phase !== "active") return;

    const tick = () => {
      const deadline = deadlineRef.current;

      if (!deadline) return;

      const now = Date.now();

      const seconds = Math.max(
        0,
        Math.ceil((deadline - now) / 1000),
      );

      setRemainingSeconds((previous) =>
        previous === seconds ? previous : seconds,
      );

      if (
        seconds === 0 &&
        now - lastSyncRef.current >= 1000
      ) {
        lastSyncRef.current = now;
        void loadSession();
      }
    };

    tick();

    const interval = window.setInterval(tick, 250);

    return () => window.clearInterval(interval);
  }, [phase, currentIndex, loadSession]);

  if (phase === "loading") {
    return (
      <div className="rounded-lg border border-line p-6">
        <p className="text-muted">Loading your quiz session...</p>
      </div>
    );
  }

  // Results now offer an immediate retake after passing or failing.
  if (phase === "result" && result) {
    return (
      <div className="rounded-lg border border-line p-6">
        <h2 className="text-2xl font-semibold">
          {result.passed
            ? "You passed!"
            : "You did not reach the pass mark"}
        </h2>

        <p className="mt-3 text-lg">
          Score: <strong>{result.percent}%</strong> (
          {result.score} of {result.total} correct)
        </p>

        <p className="mt-1 text-muted">
          Pass mark: {result.passPercent}%
        </p>

        <p className="mt-4 text-muted">
          Your result has been saved. Every attempt is preserved separately.
          {result.passed
            ? " Your certificate is available on your dashboard."
            : " You can start another attempt whenever you are ready."}
        </p>

        {error && (
          <p role="alert" className="mt-4 text-sm text-red-700">
            {error}
          </p>
        )}

        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            className="btn disabled:cursor-not-allowed disabled:opacity-50"
            disabled={busy}
            onClick={() => void startQuiz()}
          >
            {busy ? "Starting your retake..." : "Retake Quiz"}
          </button>

          <Link href="/dashboard" className="btn">
            Go to dashboard
          </Link>
        </div>
      </div>
    );
  }

  if (phase === "ready") {
    return (
      <div className="rounded-lg border border-line p-6">
        <h2 className="text-xl font-semibold">Before you start</h2>

        <ul className="mt-3 list-disc space-y-2 pl-5 text-muted">
          <li>{questionCount} multiple-choice questions.</li>
          <li>60 seconds for each question.</li>
          <li>
            Total quiz time: <strong>{questionCount} minutes</strong>.
          </li>
          <li>You need {passPercent}% or higher to pass.</li>
          <li>
            Unlimited attempts are allowed. Each attempt is saved separately.
          </li>
          <li>The timer continues if you refresh or leave the page.</li>
          <li>
            When a question's time ends, it locks and the next question
            opens automatically.
          </li>
        </ul>

        {error && (
          <p role="alert" className="mt-4 text-sm text-red-700">
            {error}
          </p>
        )}

        <button
          type="button"
          className="btn mt-5 disabled:opacity-60"
          disabled={busy}
          onClick={() => void startQuiz()}
        >
          {busy ? "Starting..." : "Start the quiz"}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-line p-5">
        <div>
          <p className="text-sm text-muted">Question</p>
          <p className="text-xl font-semibold">
            {currentIndex + 1} of {questionCount}
          </p>
        </div>

        <div className="text-right">
          <p className="text-sm text-muted">Time remaining</p>
          <p
            className={`text-2xl font-bold tabular-nums ${
              remainingSeconds <= 10 ? "text-red-600" : ""
            }`}
          >
            {String(Math.floor(remainingSeconds / 60)).padStart(2, "0")}:
            {String(remainingSeconds % 60).padStart(2, "0")}
          </p>
        </div>
      </div>

      {question && (
        <fieldset
          disabled={busy || remainingSeconds === 0}
          className="rounded-lg border border-line p-6"
        >
          <legend className="px-1 text-lg font-semibold">
            {question.prompt}
          </legend>

          <div className="mt-4 space-y-3">
            {question.options.map((option, index) => (
              <label
                key={index}
                className={`flex cursor-pointer items-start gap-3 rounded-lg border border-line p-3 hover:bg-surface ${
                  selectedAnswer === index
                    ? "border-teal-600 bg-surface"
                    : ""
                }`}
              >
                <input
                  type="radio"
                  name={`question-${currentIndex}`}
                  className="mt-1"
                  checked={selectedAnswer === index}
                  onChange={() => setSelectedAnswer(index)}
                />
                <span>{option}</span>
              </label>
            ))}
          </div>
        </fieldset>
      )}

      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="space-y-3">
        <button
          type="button"
          className="btn w-full disabled:cursor-not-allowed disabled:opacity-50"
          disabled={
            busy ||
            selectedAnswer === null ||
            remainingSeconds === 0 ||
            !question
          }
          onClick={() => void submitAnswer()}
        >
          {busy ? "Submitting answer..." : "Submit Answer"}
        </button>

        <p className="text-sm text-muted">
          {busy
            ? "Waiting for the server to confirm your submission..."
            : selectedAnswer === null
              ? "Select an option, then submit your answer before the timer expires."
              : "Your selection has not been submitted yet. Click Submit Answer to save it."}
        </p>
      </div>
    </div>
  );
}
