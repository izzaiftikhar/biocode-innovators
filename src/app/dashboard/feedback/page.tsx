
"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";

type FeedbackType = "platform" | "course";
type DisplayPreference = "first_name" | "custom" | "anonymous";
type FeedbackStatus = "pending" | "approved" | "rejected";

type Course = {
  id: string;
  title: string;
  slug: string;
};

type Feedback = {
  id: string;
  feedback_type: FeedbackType;
  course_id: string | null;
  rating: number | null;
  content: string;
  display_name_preference: DisplayPreference;
  custom_display_name: string | null;
  public_consent: boolean;
  status: FeedbackStatus;
  is_published: boolean;
  created_at: string;
  updated_at?: string;
};

export default function StudentFeedbackPage() {
  const [feedback, setFeedback] = useState<Feedback[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);

  const [feedbackType, setFeedbackType] =
    useState<FeedbackType>("platform");
  const [courseId, setCourseId] = useState("");
  const [rating, setRating] = useState("");
  const [content, setContent] = useState("");
  const [displayPreference, setDisplayPreference] =
    useState<DisplayPreference>("first_name");
  const [customDisplayName, setCustomDisplayName] = useState("");
  const [publicConsent, setPublicConsent] = useState(false);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    let active = true;

    async function loadFeedback() {
      try {
        const response = await fetch("/api/feedback", {
          method: "GET",
          cache: "no-store",
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || "Could not load your feedback.");
        }

        if (active) {
          setFeedback(result.feedback ?? []);
          setCourses(result.courses ?? []);
        }
      } catch (err) {
        if (active) {
          setError(
            err instanceof Error
              ? err.message
              : "Could not load your feedback."
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    loadFeedback();

    return () => {
      active = false;
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (feedbackType === "course" && !courseId) {
      setError("Please select an enrolled course.");
      return;
    }

    if (content.trim().length < 10 || content.trim().length > 2000) {
      setError("Feedback must contain between 10 and 2,000 characters.");
      return;
    }

    if (
      displayPreference === "custom" &&
      (customDisplayName.trim().length < 2 ||
        customDisplayName.trim().length > 60)
    ) {
      setError("Your display name must contain 2–60 characters.");
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          feedbackType,
          courseId: feedbackType === "course" ? courseId : null,
          rating: rating ? Number(rating) : null,
          content: content.trim(),
          displayNamePreference: displayPreference,
          customDisplayName:
            displayPreference === "custom"
              ? customDisplayName.trim()
              : null,
          publicConsent,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Your feedback could not be submitted.");
      }

      setFeedback((previous) => [result.feedback, ...previous]);
      setContent("");
      setRating("");
      setCourseId("");
      setFeedbackType("platform");
      setDisplayPreference("first_name");
      setCustomDisplayName("");
      setPublicConsent(false);
      setSuccess(
        result.message || "Your feedback has been submitted for review."
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  }

  function statusStyle(status: FeedbackStatus) {
    if (status === "approved") {
      return "bg-emerald-50 text-emerald-700";
    }

    if (status === "rejected") {
      return "bg-rose-50 text-rose-700";
    }

    return "bg-amber-50 text-amber-700";
  }

  return (
    <main className="container-page py-12">
      <div className="mb-8">
        <Link
          href="/dashboard"
          className="text-sm font-medium text-teal-700 hover:text-teal-900"
        >
          ← Back to dashboard
        </Link>

        <p className="mt-6 text-sm font-semibold uppercase tracking-[0.18em] text-teal-700">
          Student community
        </p>

        <h1 className="mt-2 text-3xl font-bold text-slate-900">
          Share Your Feedback
        </h1>

        <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">
          Your experience helps BioCode Innovators improve its learning
          experience, courses, and student community. We appreciate your
          honest thoughts.
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <h2 className="text-xl font-semibold text-slate-900">
            Submit your experience
          </h2>

          <p className="mt-2 text-sm text-slate-500">
            Fields marked with an asterisk are required.
          </p>

          <form onSubmit={handleSubmit} className="mt-7 space-y-6">
            <div>
              <label
                htmlFor="feedbackType"
                className="mb-2 block text-sm font-semibold text-slate-800"
              >
                What is your feedback about? *
              </label>

              <select
                id="feedbackType"
                value={feedbackType}
                onChange={(event) => {
                  setFeedbackType(event.target.value as FeedbackType);
                  setCourseId("");
                }}
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-800 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
              >
                <option value="platform">BioCode platform</option>
                <option value="course">A course I attended</option>
              </select>
            </div>

            {feedbackType === "course" && (
              <div>
                <label
                  htmlFor="courseId"
                  className="mb-2 block text-sm font-semibold text-slate-800"
                >
                  Select your enrolled course *
                </label>

                <select
                  id="courseId"
                  value={courseId}
                  onChange={(event) => setCourseId(event.target.value)}
                  required
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-800 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                >
                  <option value="">Choose a course</option>
                  {courses.map((course) => (
                    <option key={course.id} value={course.id}>
                      {course.title}
                    </option>
                  ))}
                </select>

                {courses.length === 0 && (
                  <p className="mt-2 text-sm text-amber-700">
                    No enrolled courses were found for your account.
                  </p>
                )}
              </div>
            )}

            <div>
              <label
                htmlFor="rating"
                className="mb-2 block text-sm font-semibold text-slate-800"
              >
                Your rating (optional)
              </label>

              <select
                id="rating"
                value={rating}
                onChange={(event) => setRating(event.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-800 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
              >
                <option value="">No rating</option>
                <option value="5">★★★★★ — Excellent</option>
                <option value="4">★★★★ — Very good</option>
                <option value="3">★★★ — Good</option>
                <option value="2">★★ — Fair</option>
                <option value="1">★ — Needs improvement</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="content"
                className="mb-2 block text-sm font-semibold text-slate-800"
              >
                Tell us about your experience *
              </label>

              <textarea
                id="content"
                value={content}
                onChange={(event) => setContent(event.target.value)}
                minLength={10}
                maxLength={2000}
                rows={6}
                required
                placeholder="Share what you liked, what could be improved, or how your experience has been..."
                className="w-full resize-y rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm leading-6 text-slate-800 outline-none placeholder:text-slate-400 focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
              />

              <p className="mt-2 text-right text-xs text-slate-500">
                {content.length}/2,000 characters
              </p>
            </div>

            <div className="border-t border-slate-100 pt-6">
              <h3 className="text-sm font-semibold text-slate-900">
                Public display preferences
              </h3>

              <p className="mt-2 text-sm leading-6 text-slate-500">
                If you give permission, an administrator may approve your
                feedback for public display. Your feedback is never published
                automatically.
              </p>

              <label
                htmlFor="displayPreference"
                className="mb-2 mt-5 block text-sm font-semibold text-slate-800"
              >
                How should your name appear?
              </label>

              <select
                id="displayPreference"
                value={displayPreference}
                onChange={(event) =>
                  setDisplayPreference(
                    event.target.value as DisplayPreference
                  )
                }
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-800 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
              >
                <option value="first_name">First name only</option>
                <option value="custom">Use a custom display name</option>
                <option value="anonymous">Anonymous student</option>
              </select>

              {displayPreference === "custom" && (
                <div className="mt-4">
                  <label
                    htmlFor="customDisplayName"
                    className="mb-2 block text-sm font-semibold text-slate-800"
                  >
                    Your preferred display name *
                  </label>

                  <input
                    id="customDisplayName"
                    type="text"
                    value={customDisplayName}
                    onChange={(event) =>
                      setCustomDisplayName(event.target.value)
                    }
                    minLength={2}
                    maxLength={60}
                    required
                    placeholder="Enter a display name"
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-800 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                  />
                </div>
              )}

              <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <input
                  type="checkbox"
                  checked={publicConsent}
                  onChange={(event) => setPublicConsent(event.target.checked)}
                  className="mt-1 h-4 w-4 accent-teal-700"
                />

                <span className="text-sm leading-6 text-slate-700">
                  I give BioCode Innovators permission to display my feedback
                  publicly if it is approved by an administrator. I understand
                  that my chosen display name will be used.
                  <span className="mt-1 block text-xs text-slate-500">
                    This is optional. Leaving it unchecked keeps your feedback
                    private.
                  </span>
                </span>
              </label>
            </div>

            {error && (
              <div
                role="alert"
                className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700"
              >
                {error}
              </div>
            )}

            {success && (
              <div
                role="status"
                className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700"
              >
                {success}
              </div>
            )}

            <button
              type="submit"
              disabled={
                submitting ||
                (feedbackType === "course" && courses.length === 0)
              }
              className="w-full rounded-xl bg-teal-700 px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? "Submitting..." : "Submit feedback"}
            </button>
          </form>
        </section>

        <aside className="space-y-6">
          <div className="rounded-2xl border border-teal-100 bg-teal-50/60 p-6">
            <h2 className="font-semibold text-slate-900">
              What happens next?
            </h2>

            <ol className="mt-5 space-y-4 text-sm leading-6 text-slate-600">
              <li>
                <strong className="text-slate-800">1. Submission</strong>
                <br />
                Your feedback is securely submitted for review.
              </li>
              <li>
                <strong className="text-slate-800">2. Admin review</strong>
                <br />
                Our team reviews the submission and may edit its public wording.
              </li>
              <li>
                <strong className="text-slate-800">3. Publication</strong>
                <br />
                Only approved feedback with your public consent can be published.
              </li>
            </ol>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6">
            <h2 className="font-semibold text-slate-900">
              Your privacy matters
            </h2>

            <p className="mt-3 text-sm leading-6 text-slate-600">
              Your submission is not automatically visible to other students
              or visitors. Your account email and private account details are
              not included in public feedback.
            </p>
          </div>
        </aside>
      </div>

      <section className="mt-12">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-slate-900">
            Your feedback history
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            Track the review and publication status of your submissions.
          </p>
        </div>

        {loading ? (
          <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
            Loading your feedback...
          </div>
        ) : feedback.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
            <p className="font-medium text-slate-800">
              You haven't submitted any feedback yet.
            </p>
            <p className="mt-2 text-sm text-slate-500">
              Your submissions will appear here.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {feedback.map((item) => (
              <article
                key={item.id}
                className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold capitalize text-slate-900">
                      {item.feedback_type === "course"
                        ? "Course feedback"
                        : "Platform feedback"}
                    </p>

                    <p className="mt-1 text-xs text-slate-500">
                      {new Date(item.created_at).toLocaleDateString(
                        undefined,
                        {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        }
                      )}
                    </p>
                  </div>

                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${statusStyle(
                      item.status
                    )}`}
                  >
                    {item.status}
                  </span>
                </div>

                {item.rating && (
                  <p className="mt-3 text-sm text-amber-600">
                    {"★".repeat(item.rating)}
                    {"☆".repeat(5 - item.rating)}
                  </p>
                )}

                <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-600">
                  {item.content}
                </p>

                <div className="mt-4 flex flex-wrap gap-2 text-xs">
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-600">
                    {item.public_consent
                      ? "Public display consent given"
                      : "Private submission"}
                  </span>

                  {item.is_published && (
                    <span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-700">
                      Published
                    </span>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
