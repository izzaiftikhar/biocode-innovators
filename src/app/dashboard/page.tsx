import Link from "next/link";
import { redirect } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import { createServerSupabase } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth/server";
import CertificateRequest from "./CertificateRequest";
import SignOutButton from "./SignOutButton";
import InternshipsSection from "./InternshipsSection";

export const dynamic = "force-dynamic";

type QuizAttempt = {
  course_id: string;
  score: number;
  total: number;
  percent: number;
  passed: boolean;
  attempt_number: number;
  created_at: string;
};

export default async function Dashboard() {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=%2Fdashboard");

  const db = createServerSupabase();

  const [
    { data: profile },
    { data: enrolments, error: enrolError },
    { data: certificates },
  ] = await Promise.all([
    db.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
    db.from("enrolments").select("course_id, enrolled_at").eq("user_id", user.id),
    db.from("certificates")
      .select("cert_code, course_id, status, issued_at")
      .eq("user_id", user.id)
      .order("issued_at", { ascending: false }),
  ]);

  const fullName = profile?.full_name?.trim() || "";
  const courseIds = (enrolments ?? []).map((e) => e.course_id);

  const { data: courses } = courseIds.length
    ? await db.from("courses").select("id, slug, title").in("id", courseIds)
    : { data: [] as { id: string; slug: string; title: string }[] };

  const { data: modules } = courseIds.length
    ? await db.from("modules").select("id, course_id").in("course_id", courseIds)
    : { data: [] as { id: string; course_id: string }[] };

  const { data: progress } = modules?.length
    ? await db.from("module_progress")
        .select("module_id, status")
        .eq("user_id", user.id)
        .in("module_id", modules.map((m) => m.id))
    : { data: [] as { module_id: string; status: string }[] };

  const { data: quizzes } = courseIds.length
    ? await db.from("course_quizzes")
        .select("course_id, pass_percent, published")
        .in("course_id", courseIds)
    : { data: [] as { course_id: string; pass_percent: number; published: boolean }[] };

  const { data: questionRows } = courseIds.length
    ? await db.from("quiz_questions")
        .select("course_id")
        .in("course_id", courseIds)
    : { data: [] as { course_id: string }[] };

  const { data: attempts } = await db
    .from("quiz_attempts")
    .select("course_id, score, total, percent, passed, attempt_number, created_at")
    .eq("user_id", user.id)
    .order("attempt_number", { ascending: false })
    .order("created_at", { ascending: false });

  const completed = new Set(
    (progress ?? [])
      .filter((p) => p.status === "completed")
      .map((p) => p.module_id)
  );

  return (
    <>
      <PageHeader
        title={`Welcome, ${fullName || user.email || "there"}`}
        intro="Your courses, progress and certificates."
      />

      <section className="container-page py-14">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-teal-100 bg-teal-50/50 p-5">
  <div>
    <h2 className="font-semibold text-slate-900">
      Share your experience
    </h2>
    <p className="mt-1 text-sm text-muted">
      Help us improve BioCode by sharing your feedback.
    </p>
  </div>
  <Link href="/dashboard/feedback" className="btn">
    Give feedback
  </Link>
</div>

        {enrolError && (
          <p role="alert" className="mb-6 text-sm text-red-700">
            We could not load your courses. Please refresh the page.
          </p>
        )}

        <div className="rounded-lg border border-line p-6">
          <h2 className="text-xl font-semibold">My courses</h2>

          {!courses?.length ? (
            <>
              <p className="mt-2 text-muted">You are not enrolled in any course yet.</p>
              <Link href="/courses" className="btn mt-5">Browse courses</Link>
            </>
          ) : (
            <ul className="mt-5 space-y-5">
              {courses.map((course) => {
                const courseModules = (modules ?? []).filter(
                  (m) => m.course_id === course.id
                );

                const done = courseModules.filter(
                  (m) => completed.has(m.id)
                ).length;

                const total = courseModules.length;
                const percent = total
                  ? Math.round((done / total) * 100)
                  : 0;

                const finished = total > 0 && done === total;

                const certificate = (certificates ?? []).find(
                  (c) => c.course_id === course.id && c.status === "valid"
                );

                const quizSetup = (quizzes ?? []).find(
                  (q) => q.course_id === course.id
                );

                const questionCount = (questionRows ?? []).filter(
                  (q) => q.course_id === course.id
                ).length;

                const quizRequired =
                  !!quizSetup?.published && questionCount > 0;

                const attempt = (attempts as QuizAttempt[] | null)?.find(
                  (a) => a.course_id === course.id
                );

                const revoked = (certificates ?? []).find(
                  (c) => c.course_id === course.id && c.status === "revoked"
                );

                return (
                  <li
                    key={course.id}
                    className="rounded-xl border border-line bg-white p-5"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <h3 className="text-lg font-semibold">{course.title}</h3>
                      <Link
                        href={`/courses/${course.slug}`}
                        className="btn-outline"
                      >
                        {finished ? "Review course" : "Continue learning"}
                      </Link>
                    </div>

                    <div className="mt-4">
                      <div className="flex justify-between text-sm text-muted">
                        <span>{done} of {total} modules approved</span>
                        <span>{percent}%</span>
                      </div>

                      <div
                        className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100"
                        role="progressbar"
                        aria-label={`${course.title} progress`}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={percent}
                      >
                        <div
                          className="h-full rounded-full bg-teal-600"
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>

                    {certificate ? (
                      <div className="mt-4 rounded-lg bg-surface p-4">
                        <p className="font-semibold">Your certificate is ready</p>
                        <p className="mt-1 text-sm text-muted">
                          Certificate ID: {certificate.cert_code}
                        </p>
                        <div className="mt-3 flex flex-wrap gap-3">
                          <a
                            href={`/api/certificates/${certificate.cert_code}/download`}
                            className="btn"
                          >
                            Download PDF
                          </a>
                          <Link
                            href={`/verify/${certificate.cert_code}`}
                            className="btn-outline"
                          >
                            Verification page
                          </Link>
                        </div>
                      </div>
                    ) : finished && quizRequired && !attempt ? (
                      <div className="mt-4 rounded-lg bg-surface p-4">
                        <p className="font-semibold">Final quiz</p>
                        <p className="mt-1 text-sm text-muted">
                          All modules are approved. Pass the final quiz (
                          {quizSetup?.pass_percent}% or higher) to unlock your certificate.
                        </p>
                        <Link
                          href={`/courses/${course.slug}/quiz`}
                          className="btn mt-3"
                        >
                          Take the final quiz
                        </Link>
                      </div>
                    ) : finished && quizRequired && attempt && !attempt.passed ? (
                      <div className="mt-4 rounded-lg bg-surface p-4">
                        <p className="font-semibold">
                          Final quiz: pass mark not reached
                        </p>
                        <p className="mt-1 text-sm text-muted">
                          Your latest attempt (Attempt {attempt.attempt_number})
                          scored {attempt.percent}%. The required pass mark is{" "}
                          {quizSetup?.pass_percent}%.
                        </p>
                        <p className="mt-2 text-sm text-muted">
                          You can request a retake for review by the BioCode admin team.
                          Your previous quiz attempts remain preserved.
                        </p>
                        <Link
                          href={`/courses/${course.slug}/quiz`}
                          className="btn-outline mt-3 inline-flex"
                        >
                          View quiz and retake options
                        </Link>
                      </div>
                    ) : finished && quizRequired && attempt?.passed ? (
                      <div className="mt-4 rounded-lg bg-surface p-4">
                        <p className="font-semibold">Final quiz passed</p>
                        <p className="mt-1 text-sm text-muted">
                          Your latest attempt scored {attempt.percent}%.
                        </p>
                      </div>
                    ) : finished ? (
                      <>
                        {revoked && (
                          <p className="mt-4 text-sm text-amber-800">
                            Your previous certificate was revoked. Contact BioCode if you think this is a mistake.
                          </p>
                        )}
                        {!revoked && (
                          <CertificateRequest
                            courseId={course.id}
                            initialName={fullName}
                          />
                        )}
                      </>
                    ) : (
                      <p className="mt-4 text-sm text-muted">
                        {quizRequired
                          ? "Your certificate unlocks after every module is approved and you pass the final quiz."
                          : "Your certificate unlocks after every module is approved."}
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <InternshipsSection userId={user.id} />

        <SignOutButton />
      </section>
    </>
  );
}
