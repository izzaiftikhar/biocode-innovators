import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth/server";
import { initializeCourseProgress } from "@/lib/courses/initializeProgress";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const user = await getSessionUser();

    if (!user) {
      return NextResponse.json(
        { error: "Please sign in to enrol." },
        { status: 401 },
      );
    }

    const body = (await req.json().catch(() => null)) as {
      courseId?: unknown;
    } | null;

    if (
      !body ||
      typeof body.courseId !== "string" ||
      !body.courseId.trim()
    ) {
      return NextResponse.json(
        { error: "A valid course ID is required." },
        { status: 400 },
      );
    }

    const db = createServerSupabase();

    const { data: course, error: courseError } = await db
      .from("courses")
      .select("id, published, is_free")
      .eq("id", body.courseId.trim())
      .maybeSingle();

    if (courseError) {
      console.error("Course lookup failed:", courseError);
      return NextResponse.json(
        { error: "Could not verify the course. Please try again." },
        { status: 500 },
      );
    }

    if (!course?.published) {
      return NextResponse.json(
        { error: "Course not found." },
        { status: 404 },
      );
    }

    if (course.is_free === false) {
      return NextResponse.json(
        {
          error:
            "This is a paid course. Please contact BioCode to enrol.",
        },
        { status: 403 },
      );
    }

    const { error: enrolmentError } = await db
      .from("enrolments")
      .upsert(
        {
          user_id: user.id,
          course_id: course.id,
        },
        {
          onConflict: "user_id,course_id",
          ignoreDuplicates: true,
        },
      );

    if (enrolmentError) {
      console.error("Enrolment failed:", enrolmentError);
      return NextResponse.json(
        { error: "Could not enrol you. Please try again." },
        { status: 500 },
      );
    }

    await initializeCourseProgress(user.id, course.id);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Enrol request failed:", error);

    return NextResponse.json(
      { error: "Could not complete enrolment. Please try again." },
      { status: 500 },
    );
  }
}
