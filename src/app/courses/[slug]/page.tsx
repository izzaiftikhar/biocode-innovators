
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

import { initializeCourseProgress } from "@/lib/courses/initializeProgress";
import { getQuizState } from "@/lib/courses/quiz";
import { quizRequirement } from "@/lib/courses/quiz";
import { createServerSupabase } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth/server";

import PageHeader from "@/components/PageHeader";
import ModuleAssignments from "./ModuleAssignments";
import CourseOutline from "./CourseOutline";
import EnrolButton from "./EnrolButton";
import CertificateRequest from "@/app/dashboard/CertificateRequest";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

function getPublicSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error("Supabase public environment variables are missing.");
  }

  return createClient(url, key, {
    auth: {
      persistSession: false,
    },
  });
}

async function getAuthenticatedSupabase() {
  const cookieStore = cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(
          cookiesToSet: {
            name: string;
            value: string;
            options: CookieOptions;
          }[],
        ) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Server Components cannot always write cookies.
            // Middleware handles session refresh.
          }
        },
      },
    },
  );
}

type Course = {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  level: string | null;
  duration: string | null;
  delivery: string | null;
  is_free: boolean | null;
};

type CourseModule = {
  id: string;
  position: number;
  title: string;
  youtube_id: string | null;
  notes_md: string | null;
};

async function getCourse(slug: string): Promise<Course | null> {
  const supabase = getPublicSupabase();

  const { data, error } = await supabase
    .from("courses")
    .select("id, slug, title, summary, level, duration, delivery, is_free")
    .eq("slug", slug)
    .eq("published", true)
    .maybeSingle();

  if (error) {
    console.error("Unable to load course:", error.message);
    return null;
  }

  return data as Course | null;
}

async function getCourseModules(
  courseId: string,
): Promise<CourseModule[]> {
  const supabase = getPublicSupabase();

  const { data, error } = await supabase
    .from("modules")
    .select("id, position, title, youtube_id, notes_md")
    .eq("course_id", courseId)
    .order("position", { ascending: true });

  if (error) {
    console.error("Unable to load course modules:", error.message);
    return [];
  }

  return (data ?? []) as CourseModule[];
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const course = await getCourse(params.slug);

  return {
    title: course?.title ?? "Course",
    description: course?.summary ?? undefined,
  };
}

/* ---------- Presentational helpers ---------- */

function Icon({ d }: { d: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={d} />
    </svg>
  );
}

const ICONS = {
  level: "M4 20V10M10 20V4M16 20v-7M22 20H2",
  clock: "M12 7v5l3 2M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
  video:
    "M4 6h11a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V8a2 2 0 012-2zM17 10l5-3v10l-5-3",
  tag: "M20 12l-8 8-9-9V4h7l10 8zM7.5 7.5h.01",
};

function Chip({
  icon,
  children,
}: {
  icon: string;
  children: React.ReactNode;
}) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3.5 py-1.5 text-sm font-medium">
      <span className="text-[#0e7490]">
        <Icon d={icon} />
      </span>
      {children}
    </span>
  );
}

export default async function CoursePage({
  params,
}: {
  params: { slug: string };
}) {
  const course = await getCourse(params.slug);

  if (!course) {
    notFound();
  }

  const modules = await getCourseModules(course.id);

  const lectureCount = modules.filter(
    (module) => module.youtube_id,
  ).length;

  const user = await getSessionUser();
  const isLoggedIn = !!user;

  let isEnrolled = false;
  let progressLoaded = false;
  const completedModuleIds = new Set<string>();

  let quizState:
    | Awaited<ReturnType<typeof getQuizState>>
    | null = null;

  let validCertificate: {
    cert_code: string;
  } | null = null;

  let revokedCertificate = false;
  let profileName = "";

  if (user) {
    const db = createServerSupabase();

    const { data: enrolment, error: enrolmentError } = await db
      .from("enrolments")
      .select("course_id")
      .eq("user_id", user.id)
      .eq("course_id", course.id)
      .maybeSingle();

    if (enrolmentError) {
      console.error("Unable to check enrolment:", enrolmentError.message);
    }

    isEnrolled = !!enrolment;

    if (isEnrolled) {
      let initializationSucceeded = false;

      try {
        await initializeCourseProgress(user.id, course.id);
        initializationSucceeded = true;
      } catch (error) {
        console.error(
          "Unable to initialize module progress:",
          error instanceof Error ? error.message : error,
        );
      }

      if (initializationSucceeded) {
        const { data: progress, error: progressError } = await db
          .from("module_progress")
          .select("module_id, status")
          .eq("user_id", user.id)
          .in(
            "module_id",
            modules.map((module) => module.id),
          );

        if (progressError) {
          console.error("Unable to load module progress:", progressError.message);
        } else {
          progressLoaded = true;

          for (const item of progress ?? []) {
            if (item.status === "completed") {
              completedModuleIds.add(item.module_id);
            }
          }
        }
      }

      try {
        quizState = await getQuizState(db, user.id, course.id);
      } catch (error) {
        console.error("Unable to load quiz state:", error);
      }

      const [
        { data: profile },
        { data: certificates },
      ] = await Promise.all([
        db
          .from("profiles")
          .select("full_name")
          .eq("id", user.id)
          .maybeSingle(),
        db
          .from("certificates")
          .select("cert_code, status")
          .eq("user_id", user.id)
          .eq("course_id", course.id)
          .order("issued_at", { ascending: false }),
      ]);

      profileName = profile?.full_name?.trim() || "";

      validCertificate =
        certificates?.find((item) => item.status === "valid") ?? null;

      revokedCertificate =
        certificates?.some((item) => item.status === "revoked") ?? false;
    }
  }

  const firstIncompleteIndex = modules.findIndex(
    (module) => !completedModuleIds.has(module.id),
  );

  const unlockedThroughIndex =
    firstIncompleteIndex === -1
      ? modules.length - 1
      : firstIncompleteIndex;

  const allModulesCompleted =
    modules.length > 0 &&
    progressLoaded &&
    completedModuleIds.size === modules.length;

  const quizRequired =
    quizState !== null &&
    quizState.state !== "no_quiz" &&
    quizState.state !== "not_enrolled" &&
    quizState.state !== "modules_incomplete";

  const quizPassed =
    quizState?.state === "attempted" && quizState.passed;

  const canRequestCertificate =
    allModulesCompleted &&
    (!quizRequired || quizPassed);

  return (
    <>
      <PageHeader
        title={course.title}
        intro={
          course.summary ?? "Explore this BioCode learning opportunity."
        }
      />

      <section className="container-page grid gap-10 py-12 lg:grid-cols-[1fr_21rem]">
        {/* Main column */}
        <div className="min-w-0">
          {/* Quick facts */}
          <div className="flex flex-wrap gap-3">
            {course.level && (
              <Chip icon={ICONS.level}>{course.level}</Chip>
            )}

            {course.duration && (
              <Chip icon={ICONS.clock}>{course.duration}</Chip>
            )}

            {course.delivery && (
              <Chip icon={ICONS.video}>{course.delivery}</Chip>
            )}

            <Chip icon={ICONS.tag}>
              {course.is_free ? "Free" : "Paid"}
            </Chip>
          </div>

          {/* About */}
          <div className="mt-8 rounded-xl border border-line bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold">About this course</h2>

            <p className="mt-3 whitespace-pre-wrap leading-7 text-muted">
              {course.summary || "More course details will be added soon."}
            </p>
          </div>

          {/* Curriculum */}
          <div className="mt-12 flex items-end justify-between gap-4">
            <h2 className="text-2xl font-semibold">Curriculum</h2>

            {modules.length > 0 && (
              <p className="text-sm text-muted">
                {modules.length}{" "}
                {modules.length === 1 ? "module" : "modules"}
                {lectureCount > 0 &&
                  ` · ${lectureCount} video ${
                    lectureCount === 1 ? "lecture" : "lectures"
                  }`}
              </p>
            )}
          </div>

          {modules.length === 0 ? (
            <p className="mt-4 rounded-xl border border-dashed border-line p-6 text-muted">
              No modules are available yet. Please check back later.
            </p>
          ) : (
            <div className="mt-5">
              <CourseOutline
                modules={modules.map((module, index) => {
                  const completed = completedModuleIds.has(module.id);

                  const locked =
                    !isLoggedIn ||
                    !isEnrolled ||
                    !progressLoaded ||
                    index > unlockedThroughIndex;

                  return {
                    id: module.id,
                    number: index + 1,
                    title: module.title.replace(
                      /^Module\s+\d+\s*[:.-]\s*/i,
                      "",
                    ),
                    notes: locked ? null : module.notes_md,
                    youtubeId: locked ? null : module.youtube_id,
                    assignments: locked ? null : (
                      <ModuleAssignments moduleId={module.id} />
                    ),
                    locked,
                    completed,
                    loginRequired: !isLoggedIn,
                    enrolRequired: isLoggedIn && !isEnrolled,
                  };
                })}
              />
            </div>
          )}

          {/* Final quiz */}
          {isLoggedIn && isEnrolled && (
            <section className="mt-12 rounded-xl border border-line bg-white p-6 shadow-sm">
              <h2 className="text-xl font-semibold">Final quiz</h2>

              {!progressLoaded ? (
                <p className="mt-3 text-sm text-muted">
                  We could not verify your module progress. Please refresh the page.
                </p>
              ) : !allModulesCompleted ? (
                <p className="mt-3 text-sm text-muted">
                  Complete and get approval for all {modules.length} modules
                  to unlock the final quiz.
                </p>
              ) : !quizState || quizState.state === "no_quiz" ? (
                <p className="mt-3 text-sm text-muted">
                  The final quiz is not available yet. Please check back later.
                </p>
              ) : quizState.state === "attempted" ? (
                <div className="mt-3">
                  <p className="font-medium">
                    {quizState.passed ? "You passed the final quiz!" : "Quiz attempt used"}
                  </p>
                  <p className="mt-2 text-sm text-muted">
                    Your score: {quizState.score} / {quizState.total} ({quizState.percent}%).
                    Required pass mark: {quizState.passPercent}%.
                  </p>
                                    {!quizState.passed && (
                    <div className="mt-3">
                      <p className="text-sm text-muted">
                        If you did not pass, you can visit the quiz page to
                        request a retake. Your previous attempt will remain
                        preserved in your quiz history.
                      </p>

                      <Link
                        href={`/courses/${course.slug}/quiz`}
                        className="btn-outline mt-4 inline-flex"
                      >
                        View quiz and retake options
                      </Link>
                    </div>
                  )}
                </div>
              ) : quizState.state === "ready" ? (
                <div className="mt-3">
                  <p className="text-sm text-muted">
                    All modules are approved. You can now take the final quiz.
                    You need {quizState.passPercent}% or higher to pass.
                  </p>
                  <Link
                    href={`/courses/${course.slug}/quiz`}
                    className="btn mt-4 inline-flex"
                  >
                    Take the final quiz
                  </Link>
                </div>
              ) : (
                <p className="mt-3 text-sm text-muted">
                  Complete the course requirements to unlock your final quiz.
                </p>
              )}
            </section>
          )}

          {/* Certificate */}
          {isLoggedIn && isEnrolled && (
            <section className="mt-6 rounded-xl border border-line bg-white p-6 shadow-sm">
              <h2 className="text-xl font-semibold">Course certificate</h2>

              {!progressLoaded ? (
                <p className="mt-3 text-sm text-muted">
                  Certificate eligibility will appear once your progress is verified.
                </p>
              ) : !allModulesCompleted ? (
                <p className="mt-3 text-sm text-muted">
                  Your certificate becomes available after all course modules are approved.
                </p>
              ) : quizRequired && !quizPassed ? (
                <p className="mt-3 text-sm text-muted">
                  Pass the final quiz to unlock your certificate.
                </p>
              ) : validCertificate ? (
                <div className="mt-3">
                  <p className="font-medium">Your certificate is ready!</p>
                  <p className="mt-2 text-sm text-muted">
                    Certificate ID: {validCertificate.cert_code}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-3">
                    <a
                      href={`/api/certificates/${validCertificate.cert_code}/download`}
                      className="btn"
                    >
                      Download PDF
                    </a>
                    <Link
                      href={`/verify/${validCertificate.cert_code}`}
                      className="btn-outline"
                    >
                      Verification page
                    </Link>
                  </div>
                </div>
              ) : revokedCertificate ? (
                <p className="mt-3 text-sm text-amber-800">
                  Your previous certificate was revoked. Please contact BioCode for assistance.
                </p>
              ) : canRequestCertificate ? (
                <div className="mt-3">
                  <p className="mb-3 text-sm text-muted">
                    You have completed the course requirements. Confirm your name
                    to generate your certificate.
                  </p>
                  <CertificateRequest
                    courseId={course.id}
                    initialName={profileName}
                  />
                </div>
              ) : (
                <p className="mt-3 text-sm text-muted">
                  Complete the course requirements to unlock your certificate.
                </p>
              )}
            </section>
          )}
        </div>

        {/* Sidebar */}
        <aside className="h-fit space-y-6 lg:sticky lg:top-28">
          <div className="rounded-xl border border-line bg-white p-6 shadow-sm">
            <p className="text-2xl font-semibold">
              {course.is_free ? "Free" : "Paid course"}
            </p>

            {!isLoggedIn ? (
              <Link
                href={`/login?next=${encodeURIComponent(`/courses/${course.slug}`)}`}
                className="btn mt-5 block w-full text-center"
              >
                Sign in to enrol
              </Link>
            ) : isEnrolled ? (
              <Link
                href="/dashboard"
                className="btn mt-5 block w-full text-center"
              >
                Go to your dashboard
              </Link>
            ) : (
              <EnrolButton courseId={course.id} />
            )}

            <p className="mt-3 text-center text-xs text-muted">
              {!isLoggedIn
                ? "Sign in to continue your learning journey."
                : isEnrolled
                  ? "You are enrolled. Continue your learning journey."
                  : "Enrol to unlock Module 1."}
            </p>

            <dl className="mt-6 space-y-3 border-t border-line pt-5 text-sm">
              {[
                ["Level", course.level],
                ["Duration", course.duration],
                ["Delivery", course.delivery],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="flex justify-between gap-4"
                >
                  <dt className="text-muted">{label}</dt>
                  <dd className="text-right font-semibold">
                    {value || "Not specified"}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </aside>
      </section>
    </>
  );
}
