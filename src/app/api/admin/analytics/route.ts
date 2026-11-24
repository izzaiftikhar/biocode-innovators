
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  createServerClient,
  type CookieOptions,
} from "@supabase/ssr";
import { createServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type EnrolmentRow = {
  user_id: string;
  course_id: string;
  enrolled_at: string | null;
};

type CourseRow = {
  id: string;
  title: string;
  published: boolean;
};

type SubmissionRow = {
  id: string;
  review_status: string | null;
  score: number | null;
  created_at: string | null;
};

type QuizAttemptRow = {
  course_id: string;
  percent: number;
  passed: boolean;
  attempt_number: number;
  created_at: string;
};

type CertificateRow = {
  status: string;
  issued_at: string;
};

type QueryError = {
  message: string;
};

async function fetchAllRows<T>(
  loadPage: (
    from: number,
    to: number,
  ) => Promise<{
    data: T[] | null;
    error: QueryError | null;
  }>,
): Promise<T[]> {
  const pageSize = 1000;
  const rows: T[] = [];

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await loadPage(from, from + pageSize - 1);

    if (error) {
      throw new Error(error.message);
    }

    const page = data ?? [];
    rows.push(...page);

    if (page.length < pageSize) {
      break;
    }
  }

  return rows;
}

export async function GET() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !anonKey) {
      return NextResponse.json(
        { error: "Authentication is not configured." },
        { status: 500 },
      );
    }

    // Verify the signed-in user's Supabase session.
    const cookieStore = cookies();

    const authSupabase = createServerClient(supabaseUrl, anonKey, {
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
            // Cookie updates may not be available in every context.
          }
        },
      },
    });

    const {
      data: { user },
      error: authError,
    } = await authSupabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Please sign in as an admin." },
        { status: 401 },
      );
    }

    // Verify admin permissions independently on the server.
    const db = createServerSupabase();

    const { data: adminRole, error: roleError } = await db
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (roleError) {
      console.error("Analytics role check failed:", roleError);
      return NextResponse.json(
        { error: "Could not verify admin permissions." },
        { status: 500 },
      );
    }

    if (!adminRole) {
      return NextResponse.json(
        { error: "Only admins can view analytics." },
        { status: 403 },
      );
    }

    // Read all rows in pages to avoid silently stopping at Supabase's
    // default response limit.
    const [
      courses,
      enrolments,
      submissions,
      quizAttempts,
      certificates,
    ] = await Promise.all([
      fetchAllRows<CourseRow>(async (from, to) => {
        const { data, error } = await db
          .from("courses")
          .select("id, title, published")
          .order("created_at", { ascending: false })
          .range(from, to);

        return { data: data as CourseRow[] | null, error };
      }),

      fetchAllRows<EnrolmentRow>(async (from, to) => {
        const { data, error } = await db
          .from("enrolments")
          .select("user_id, course_id, enrolled_at")
          .range(from, to);

        return { data: data as EnrolmentRow[] | null, error };
      }),

      fetchAllRows<SubmissionRow>(async (from, to) => {
        const { data, error } = await db
          .from("submissions")
          .select("id, review_status, score, created_at")
          .range(from, to);

        return { data: data as SubmissionRow[] | null, error };
      }),

      fetchAllRows<QuizAttemptRow>(async (from, to) => {
        const { data, error } = await db
          .from("quiz_attempts")
          .select(
            "course_id, percent, passed, attempt_number, created_at",
          )
          .range(from, to);

        return { data: data as QuizAttemptRow[] | null, error };
      }),

      fetchAllRows<CertificateRow>(async (from, to) => {
        const { data, error } = await db
          .from("certificates")
          .select("status, issued_at")
          .range(from, to);

        return { data: data as CertificateRow[] | null, error };
      }),
    ]);

    const enrolledStudentIds = new Set(
      enrolments.map((item) => item.user_id),
    );

    const courseAnalytics = courses.map((course) => {
      const courseEnrolments = enrolments.filter(
        (item) => item.course_id === course.id,
      );

      const courseAttempts = quizAttempts.filter(
        (item) => item.course_id === course.id,
      );

      const passedAttempts = courseAttempts.filter(
        (item) => item.passed,
      ).length;

      const averageScore =
        courseAttempts.length > 0
          ? Math.round(
              courseAttempts.reduce(
                (sum, item) => sum + Number(item.percent || 0),
                0,
              ) / courseAttempts.length,
            )
          : null;

      return {
        id: course.id,
        title: course.title,
        published: course.published,
        enrolments: courseEnrolments.length,
        quizAttempts: courseAttempts.length,
        passedAttempts,
        passRate:
          courseAttempts.length > 0
            ? Math.round(
                (passedAttempts / courseAttempts.length) * 100,
              )
            : null,
        averageScore,
      };
    });

    const submissionCounts = {
      total: submissions.length,
      pending: submissions.filter(
        (item) => item.review_status === "pending",
      ).length,
      approved: submissions.filter(
        (item) => item.review_status === "approved",
      ).length,
      changesRequested: submissions.filter(
        (item) => item.review_status === "changes_requested",
      ).length,
      other: submissions.filter(
        (item) =>
          !["pending", "approved", "changes_requested"].includes(
            item.review_status ?? "",
          ),
      ).length,
    };

    const passedAttempts = quizAttempts.filter(
      (item) => item.passed,
    ).length;

    const averageQuizScore =
      quizAttempts.length > 0
        ? Math.round(
            quizAttempts.reduce(
              (sum, item) => sum + Number(item.percent || 0),
              0,
            ) / quizAttempts.length,
          )
        : null;

    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      overview: {
        enrolledStudents: enrolledStudentIds.size,
        totalEnrolments: enrolments.length,
        totalCourses: courses.length,
        publishedCourses: courses.filter((course) => course.published)
          .length,
        totalSubmissions: submissions.length,
        totalQuizAttempts: quizAttempts.length,
        passedQuizAttempts: passedAttempts,
        quizPassRate:
          quizAttempts.length > 0
            ? Math.round(
                (passedAttempts / quizAttempts.length) * 100,
              )
            : null,
        averageQuizScore,
        totalCertificates: certificates.length,
        validCertificates: certificates.filter(
          (item) => item.status === "valid",
        ).length,
        revokedCertificates: certificates.filter(
          (item) => item.status === "revoked",
        ).length,
      },
      submissions: submissionCounts,
      courses: courseAnalytics,
    });
  } catch (error) {
    console.error("Admin analytics request failed:", error);

    return NextResponse.json(
      { error: "Could not load analytics. Please try again." },
      { status: 500 },
    );
  }
}
