import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type FeedbackType = "platform" | "course";
type DisplayPreference = "first_name" | "custom" | "anonymous";

export async function GET() {
  try {
    const user = await getSessionUser();

    if (!user) {
      return NextResponse.json(
        { error: "Please sign in to view your feedback." },
        { status: 401 }
      );
    }

    const db = createServerSupabase();

    const { data, error } = await db
      .from("student_feedback")
      .select(
        "id, feedback_type, course_id, rating, content, display_name_preference, custom_display_name, public_consent, status, is_published, created_at, updated_at"
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Student feedback lookup failed:", error);
      return NextResponse.json(
        { error: "Could not load your feedback." },
        { status: 500 }
      );
    }

    const { data: enrolments, error: enrolmentError } = await db
  .from("enrolments")
  .select("course_id")
  .eq("user_id", user.id);

if (enrolmentError) {
  console.error("Student enrolment lookup failed:", enrolmentError);
  return NextResponse.json(
    { error: "Could not load your enrolled courses." },
    { status: 500 }
  );
}

const courseIds = [
  ...new Set((enrolments ?? []).map((item) => item.course_id)),
];

let courses: { id: string; title: string; slug: string }[] = [];

if (courseIds.length > 0) {
  const { data: courseData, error: courseError } = await db
    .from("courses")
    .select("id, title, slug")
    .in("id", courseIds);

  if (courseError) {
    console.error("Enrolled course lookup failed:", courseError);
    return NextResponse.json(
      { error: "Could not load your enrolled courses." },
      { status: 500 }
    );
  }

  courses = courseData ?? [];
}

return NextResponse.json({
  feedback: data ?? [],
  courses,
});
  } catch (error) {
    console.error("Student feedback request failed:", error);

    return NextResponse.json(
      { error: "An unexpected error occurred." },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const user = await getSessionUser();

    if (!user) {
      return NextResponse.json(
        { error: "Please sign in before submitting feedback." },
        { status: 401 }
      );
    }

    const body = (await req.json().catch(() => null)) as {
      feedbackType?: unknown;
      courseId?: unknown;
      rating?: unknown;
      content?: unknown;
      displayNamePreference?: unknown;
      customDisplayName?: unknown;
      publicConsent?: unknown;
    } | null;

    if (!body) {
      return NextResponse.json(
        { error: "A valid feedback submission is required." },
        { status: 400 }
      );
    }

    if (
      body.feedbackType !== "platform" &&
      body.feedbackType !== "course"
    ) {
      return NextResponse.json(
        { error: "Choose platform feedback or course feedback." },
        { status: 400 }
      );
    }

    const feedbackType = body.feedbackType as FeedbackType;

    if (typeof body.content !== "string") {
      return NextResponse.json(
        { error: "Please write your feedback." },
        { status: 400 }
      );
    }

    const content = body.content.trim();

    if (content.length < 10 || content.length > 2000) {
      return NextResponse.json(
        { error: "Feedback must be between 10 and 2,000 characters." },
        { status: 400 }
      );
    }

    const rating =
      body.rating === undefined || body.rating === null || body.rating === ""
        ? null
        : body.rating;

    if (
      rating !== null &&
      (typeof rating !== "number" ||
        !Number.isInteger(rating) ||
        rating < 1 ||
        rating > 5)
    ) {
      return NextResponse.json(
        { error: "Rating must be a whole number from 1 to 5." },
        { status: 400 }
      );
    }

    if (typeof body.publicConsent !== "boolean") {
      return NextResponse.json(
        {
          error:
            "Please choose whether you consent to your feedback being displayed publicly.",
        },
        { status: 400 }
      );
    }

    const displayPreference: DisplayPreference =
      body.displayNamePreference === undefined
        ? "first_name"
        : (body.displayNamePreference as DisplayPreference);

    if (
      !["first_name", "custom", "anonymous"].includes(displayPreference)
    ) {
      return NextResponse.json(
        { error: "Choose a valid display-name preference." },
        { status: 400 }
      );
    }

    let customDisplayName: string | null = null;

    if (displayPreference === "custom") {
      if (typeof body.customDisplayName !== "string") {
        return NextResponse.json(
          { error: "Enter the name you want displayed." },
          { status: 400 }
        );
      }

      customDisplayName = body.customDisplayName.trim();

      if (
        customDisplayName.length < 2 ||
        customDisplayName.length > 60
      ) {
        return NextResponse.json(
          { error: "Your display name must be between 2 and 60 characters." },
          { status: 400 }
        );
      }
    }

    let courseId: string | null = null;

    if (feedbackType === "course") {
      if (
        typeof body.courseId !== "string" ||
        !UUID_PATTERN.test(body.courseId)
      ) {
        return NextResponse.json(
          { error: "Choose a valid course." },
          { status: 400 }
        );
      }

      courseId = body.courseId;

      const db = createServerSupabase();

      const [{ data: course, error: courseError }, { data: enrolment, error: enrolmentError }] =
        await Promise.all([
          db
            .from("courses")
            .select("id")
            .eq("id", courseId)
            .maybeSingle(),
          db
            .from("enrolments")
            .select("course_id")
            .eq("user_id", user.id)
            .eq("course_id", courseId)
            .maybeSingle(),
        ]);

      if (courseError || enrolmentError) {
        console.error("Feedback course verification failed:", {
          courseError,
          enrolmentError,
        });

        return NextResponse.json(
          { error: "Could not verify your course enrolment." },
          { status: 500 }
        );
      }

      if (!course) {
        return NextResponse.json(
          { error: "The selected course could not be found." },
          { status: 404 }
        );
      }

      if (!enrolment) {
        return NextResponse.json(
          { error: "You can only review a course you are enrolled in." },
          { status: 403 }
        );
      }
    } else if (body.courseId !== undefined && body.courseId !== null && body.courseId !== "") {
      return NextResponse.json(
        { error: "Platform feedback must not include a course." },
        { status: 400 }
      );
    }

    const db = createServerSupabase();

    const { data: submission, error: insertError } = await db
      .from("student_feedback")
      .insert({
        user_id: user.id,
        feedback_type: feedbackType,
        course_id: courseId,
        rating,
        content,
        display_name_preference: displayPreference,
        custom_display_name: customDisplayName,
        public_consent: body.publicConsent,

        // Moderation fields are always controlled by the server/admin.
        status: "pending",
        is_published: false,
        admin_edited_content: null,
        public_display_name: null,
        display_placement: ["feedback_page"],
        internal_note: null,
        reviewed_by: null,
        reviewed_at: null,
        published_at: null,
      })
      .select(
        "id, feedback_type, course_id, rating, content, display_name_preference, custom_display_name, public_consent, status, is_published, created_at"
      )
      .single();

    if (insertError || !submission) {
      console.error("Feedback submission failed:", insertError);

      return NextResponse.json(
        { error: "Your feedback could not be submitted. Please try again." },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        ok: true,
        feedback: submission,
        message: "Your feedback has been submitted for admin review.",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Feedback submission request failed:", error);

    return NextResponse.json(
      { error: "An unexpected error occurred while submitting feedback." },
      { status: 500 }
    );
  }
}
