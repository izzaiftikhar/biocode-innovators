
"use client";

import { useCallback, useEffect, useState } from "react";

type AnalyticsData = {
  generatedAt: string;
  overview: {
    enrolledStudents: number;
    totalEnrolments: number;
    totalCourses: number;
    publishedCourses: number;
    totalSubmissions: number;
    totalQuizAttempts: number;
    passedQuizAttempts: number;
    quizPassRate: number | null;
    averageQuizScore: number | null;
    totalCertificates: number;
    validCertificates: number;
    revokedCertificates: number;
  };
  submissions: {
    total: number;
    pending: number;
    approved: number;
    changesRequested: number;
    other: number;
  };
  courses: {
    id: string;
    title: string;
    published: boolean;
    enrolments: number;
    quizAttempts: number;
    passedAttempts: number;
    passRate: number | null;
    averageScore: number | null;
  }[];
};

function formatNumber(value: number) {
  return new Intl.NumberFormat().format(value);
}

function MetricCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string | number;
  detail?: string;
}) {
  return (
    <article className="rounded-2xl border border-line bg-surface p-5">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-3 text-3xl font-semibold tracking-tight">
        {value}
      </p>
      {detail && <p className="mt-2 text-xs text-muted">{detail}</p>}
    </article>
  );
}

export default function AdminAnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const loadAnalytics = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setError("");

    try {
      const response = await fetch("/api/admin/analytics", {
        method: "GET",
        cache: "no-store",
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Could not load analytics.");
      }

      setData(result as AnalyticsData);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong while loading analytics.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadAnalytics();
  }, [loadAnalytics]);

  const overview = data?.overview;
  const submissions = data?.submissions;

  return (
    <main className="container-page py-12">
      <header className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-2 text-sm font-semibold uppercase tracking-[0.2em] text-muted">
            BioCode Innovators · Research Wing
          </p>
          <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
            Platform analytics
          </h1>
          <p className="mt-3 max-w-2xl text-muted">
            An overview of course enrolments, student submissions,
            quiz performance, and certificates.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void loadAnalytics(true)}
          disabled={loading || refreshing}
          className="rounded-xl border border-line px-4 py-2.5 text-sm font-medium transition hover:border-primary disabled:cursor-not-allowed disabled:opacity-50"
        >
          {refreshing ? "Refreshing..." : "Refresh data"}
        </button>
      </header>

      {loading && (
        <div className="rounded-2xl border border-line p-8 text-sm text-muted">
          Loading platform analytics...
        </div>
      )}

      {!loading && error && (
        <div
          role="alert"
          className="rounded-2xl border border-red-500/30 bg-red-500/5 p-5"
        >
          <p className="font-medium">Analytics could not be loaded</p>
          <p className="mt-2 text-sm text-muted">{error}</p>
          <button
            type="button"
            onClick={() => void loadAnalytics()}
            className="mt-4 text-sm font-semibold underline underline-offset-4"
          >
            Try again
          </button>
        </div>
      )}

      {!loading && !error && data && overview && submissions && (
        <>
          <section aria-label="Platform overview">
            <h2 className="mb-4 text-lg font-semibold">
              Platform overview
            </h2>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <MetricCard
                label="Enrolled students"
                value={formatNumber(overview.enrolledStudents)}
                detail="Unique students with at least one enrolment"
              />
              <MetricCard
                label="Total enrolments"
                value={formatNumber(overview.totalEnrolments)}
                detail="Student-course enrolment records"
              />
              <MetricCard
                label="Published courses"
                value={formatNumber(overview.publishedCourses)}
                detail={`${formatNumber(overview.totalCourses)} courses in total`}
              />
              <MetricCard
                label="Certificates issued"
                value={formatNumber(overview.totalCertificates)}
                detail={`${formatNumber(overview.validCertificates)} valid · ${formatNumber(overview.revokedCertificates)} revoked`}
              />
            </div>
          </section>

          <section className="mt-10" aria-label="Learning performance">
            <h2 className="mb-4 text-lg font-semibold">
              Learning performance
            </h2>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <MetricCard
                label="Assignment submissions"
                value={formatNumber(submissions.total)}
              />
              <MetricCard
                label="Quiz attempts"
                value={formatNumber(overview.totalQuizAttempts)}
                detail={`${formatNumber(overview.passedQuizAttempts)} passed attempts`}
              />
              <MetricCard
                label="Quiz pass rate"
                value={
                  overview.quizPassRate === null
                    ? "—"
                    : `${overview.quizPassRate}%`
                }
                detail="Based on all recorded attempts"
              />
              <MetricCard
                label="Average quiz score"
                value={
                  overview.averageQuizScore === null
                    ? "—"
                    : `${overview.averageQuizScore}%`
                }
                detail="Average percentage across all attempts"
              />
            </div>
          </section>

          <section className="mt-10" aria-label="Submission review status">
            <h2 className="mb-4 text-lg font-semibold">
              Assignment review status
            </h2>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <MetricCard
                label="Pending review"
                value={formatNumber(submissions.pending)}
              />
              <MetricCard
                label="Approved"
                value={formatNumber(submissions.approved)}
              />
              <MetricCard
                label="Changes requested"
                value={formatNumber(submissions.changesRequested)}
              />
              <MetricCard
                label="Other statuses"
                value={formatNumber(submissions.other)}
              />
            </div>
          </section>

          <section className="mt-10" aria-label="Course performance">
            <h2 className="mb-4 text-lg font-semibold">
              Course performance
            </h2>

            <div className="overflow-hidden rounded-2xl border border-line">
              {data.courses.length === 0 ? (
                <p className="p-6 text-sm text-muted">
                  No courses found.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[680px] text-left text-sm">
                    <thead className="border-b border-line bg-surface">
                      <tr>
                        <th className="px-5 py-4 font-semibold">Course</th>
                        <th className="px-5 py-4 font-semibold">Status</th>
                        <th className="px-5 py-4 font-semibold">Enrolments</th>
                        <th className="px-5 py-4 font-semibold">Quiz attempts</th>
                        <th className="px-5 py-4 font-semibold">Pass rate</th>
                        <th className="px-5 py-4 font-semibold">Avg. score</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.courses.map((course) => (
                        <tr
                          key={course.id}
                          className="border-b border-line last:border-0"
                        >
                          <td className="px-5 py-4 font-medium">
                            {course.title}
                          </td>
                          <td className="px-5 py-4 text-muted">
                            {course.published ? "Published" : "Draft"}
                          </td>
                          <td className="px-5 py-4 tabular-nums">
                            {formatNumber(course.enrolments)}
                          </td>
                          <td className="px-5 py-4 tabular-nums">
                            {formatNumber(course.quizAttempts)}
                          </td>
                          <td className="px-5 py-4 tabular-nums">
                            {course.passRate === null
                              ? "—"
                              : `${course.passRate}%`}
                          </td>
                          <td className="px-5 py-4 tabular-nums">
                            {course.averageScore === null
                              ? "—"
                              : `${course.averageScore}%`}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>

          <p className="mt-6 text-xs text-muted">
            Last updated:{" "}
            {new Date(data.generatedAt).toLocaleString()}
          </p>
        </>
      )}
    </main>
  );
}
