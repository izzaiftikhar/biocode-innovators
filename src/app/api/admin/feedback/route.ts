
import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getSessionUser, isAdmin } from "@/lib/auth/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ALLOWED_PLACEMENTS = [
  "homepage",
  "feedback_page",
  "course_page",
] as const;

type FeedbackStatus = "pending" | "approved" | "rejected";

async function requireAdmin() {
  const user = await getSessionUser();

  if (!user) {
    return {
      user: null,
      response: NextResponse.json(
        { error: "Please sign in." },
        { status: 401 }
      ),
    };
  }

  const admin = await isAdmin(user.id);

  if (!admin) {
    return {
      user: null,
      response: NextResponse.json(
        { error: "You are not authorized to manage feedback." },
        { status: 403 }
      ),
    };
  }

  return { user, response: null };
}

export async function GET() {
  try {
    const auth = await requireAdmin();
    if (auth.response) return auth.response;

    const db = createServerSupabase();

    const { data: feedback, error } = await db
      .from("student_feedback")
      .select(
        "id, user_id, feedback_type, course_id, rating, content, display_name_preference, custom_display_name, public_consent, status, is_published, admin_edited_content, public_display_name, display_placement, internal_note, reviewed_by, reviewed_at, published_at, created_at, updated_at"
      )
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) {
      console.error("Admin feedback lookup failed:", error);

      return NextResponse.json(
        { error: "Could not load feedback submissions." },
        { status: 500 }
      );
    }

    const rows = feedback ?? [];

    const userIds = [...new Set(rows.map((item) => item.user_id))];

    const courseIds = [
      ...new Set(
        rows
          .map((item) => item.course_id)
          .filter((id): id is string => Boolean(id))
      ),
    ];

    const [profilesResult, coursesResult] = await Promise.all([
      userIds.length
        ? db
            .from("profiles")
            .select("id, full_name")
            .in("id", userIds)
        : Promise.resolve({ data: [], error: null }),

      courseIds.length
        ? db
            .from("courses")
            .select("id, title")
            .in("id", courseIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (profilesResult.error || coursesResult.error) {
      console.error("Feedback labels lookup failed:", {
        profilesError: profilesResult.error,
        coursesError: coursesResult.error,
      });

      return NextResponse.json(
        { error: "Could not load student or course details." },
        { status: 500 }
      );
    }

    const profileMap = new Map(
      (profilesResult.data ?? []).map((profile) => [
        profile.id,
        profile.full_name,
      ])
    );

    const courseMap = new Map(
      (coursesResult.data ?? []).map((course) => [
        course.id,
        course.title,
      ])
    );

    const enrichedFeedback = rows.map((item) => ({
      ...item,
      student_name: profileMap.get(item.user_id) ?? "Unknown student",
      course_title: item.course_id
        ? courseMap.get(item.course_id) ?? "Course unavailable"
        : null,
    }));

    return NextResponse.json({
      feedback: enrichedFeedback,
    });
  } catch (error) {
    console.error("Admin feedback request failed:", error);

    return NextResponse.json(
      { error: "An unexpected error occurred." },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request) {
  try {
    const auth = await requireAdmin();
    if (auth.response) return auth.response;

    const body = (await req.json().catch(() => null)) as {
      id?: unknown;
      status?: unknown;
      isPublished?: unknown;
      adminEditedContent?: unknown;
      internalNote?: unknown;
      displayPlacement?: unknown;
      publicDisplayName?: unknown;
    } | null;

    if (!body || typeof body.id !== "string" || !UUID_PATTERN.test(body.id)) {
      return NextResponse.json(
        { error: "A valid feedback ID is required." },
        { status: 400 }
      );
    }

    if (
      body.status !== undefined &&
      !["pending", "approved", "rejected"].includes(body.status as string)
    ) {
      return NextResponse.json(
        { error: "Choose a valid moderation status." },
        { status: 400 }
      );
    }

    if (
      body.isPublished !== undefined &&
      typeof body.isPublished !== "boolean"
    ) {
      return NextResponse.json(
        { error: "Publication status must be true or false." },
        { status: 400 }
      );
    }

    let editedContent: string | null | undefined;

    if (body.adminEditedContent !== undefined) {
      if (
        body.adminEditedContent !== null &&
        typeof body.adminEditedContent !== "string"
      ) {
        return NextResponse.json(
          { error: "Edited feedback must be text." },
          { status: 400 }
        );
      }

      editedContent =
        typeof body.adminEditedContent === "string"
          ? body.adminEditedContent.trim() || null
          : null;

      if (editedContent && editedContent.length > 2000) {
        return NextResponse.json(
          { error: "Edited feedback cannot exceed 2,000 characters." },
          { status: 400 }
        );
      }
    }

    let internalNote: string | undefined;

    if (body.internalNote !== undefined) {
      if (typeof body.internalNote !== "string") {
        return NextResponse.json(
          { error: "Internal notes must be text." },
          { status: 400 }
        );
      }

      internalNote = body.internalNote.trim();

      if (internalNote.length > 2000) {
        return NextResponse.json(
          { error: "Internal notes cannot exceed 2,000 characters." },
          { status: 400 }
        );
      }
    }

    let placements: string[] | undefined;

    if (body.displayPlacement !== undefined) {
      if (
        !Array.isArray(body.displayPlacement) ||
        !body.displayPlacement.every(
          (item) =>
            typeof item === "string" &&
            (ALLOWED_PLACEMENTS as readonly string[]).includes(item)
        )
      ) {
        return NextResponse.json(
          { error: "One or more display placements are invalid." },
          { status: 400 }
        );
      }

      placements = [...new Set(body.displayPlacement as string[])];
    }

    let requestedPublicName: string | undefined;

    if (body.publicDisplayName !== undefined) {
      if (typeof body.publicDisplayName !== "string") {
        return NextResponse.json(
          { error: "Public display name must be text." },
          { status: 400 }
        );
      }

      requestedPublicName = body.publicDisplayName.trim();

      if (
        requestedPublicName.length < 2 ||
        requestedPublicName.length > 60
      ) {
        return NextResponse.json(
          { error: "Public display name must be between 2 and 60 characters." },
          { status: 400 }
        );
      }
    }

    const db = createServerSupabase();

    const { data: existing, error: lookupError } = await db
      .from("student_feedback")
      .select(
        "id, user_id, feedback_type, course_id, content, display_name_preference, custom_display_name, public_consent, status, is_published, display_placement"
      )
      .eq("id", body.id)
      .maybeSingle();

    if (lookupError) {
      console.error("Feedback moderation lookup failed:", lookupError);

      return NextResponse.json(
        { error: "Could not load this feedback submission." },
        { status: 500 }
      );
    }

    if (!existing) {
      return NextResponse.json(
        { error: "Feedback submission not found." },
        { status: 404 }
      );
    }

    const nextStatus = (body.status ?? existing.status) as FeedbackStatus;

    let nextPublished =
      body.isPublished === undefined
        ? existing.is_published
        : body.isPublished;

    if (nextStatus !== "approved" || !existing.public_consent) {
      nextPublished = false;
    }

    const nextPlacements =
      placements ?? existing.display_placement ?? [];

    if (
      existing.feedback_type === "platform" &&
      nextPlacements.includes("course_page")
    ) {
      return NextResponse.json(
        { error: "Platform feedback cannot appear on a course page." },
        { status: 400 }
      );
    }

    if (
      existing.feedback_type === "course" &&
      nextPlacements.includes("course_page") &&
      !existing.course_id
    ) {
      return NextResponse.json(
        { error: "This feedback has no associated course." },
        { status: 400 }
      );
    }

    if (nextPublished && nextPlacements.length === 0) {
      return NextResponse.json(
        { error: "Choose at least one public placement before publishing." },
        { status: 400 }
      );
    }

    if (body.isPublished === true && !existing.public_consent) {
      return NextResponse.json(
        {
          error:
            "This student did not consent to public display. The feedback must remain private.",
        },
        { status: 403 }
      );
    }

    if (body.isPublished === true && nextStatus !== "approved") {
      return NextResponse.json(
        { error: "Approve the feedback before publishing it." },
        { status: 400 }
      );
    }

    const publicContent =
      editedContent === undefined ? null : editedContent;

    const effectiveContent = publicContent ?? existing.content;

    if (nextPublished && effectiveContent.trim().length < 10) {
      return NextResponse.json(
        { error: "Public feedback must contain at least 10 characters." },
        { status: 400 }
      );
    }

    let publicDisplayName: string | null = null;

    if (nextPublished) {
      if (requestedPublicName) {
        publicDisplayName = requestedPublicName;
      } else if (existing.display_name_preference === "anonymous") {
        publicDisplayName = "Anonymous student";
      } else if (existing.display_name_preference === "custom") {
        publicDisplayName = existing.custom_display_name;
      } else {
        const { data: profile, error: profileError } = await db
          .from("profiles")
          .select("full_name")
          .eq("id", existing.user_id)
          .maybeSingle();

        if (profileError) {
          console.error(
            "Feedback display name lookup failed:",
            profileError
          );

          return NextResponse.json(
            { error: "Could not verify the student's display name." },
            { status: 500 }
          );
        }

        const fullName =
          typeof profile?.full_name === "string"
            ? profile.full_name.trim()
            : "";

        publicDisplayName = fullName.split(/\s+/)[0] || "Student";
      }

      if (!publicDisplayName) {
        return NextResponse.json(
          { error: "Set a public display name before publishing." },
          { status: 400 }
        );
      }
    }

    const now = new Date().toISOString();

    const update: Record<string, unknown> = {
      status: nextStatus,
      is_published: nextPublished,
      display_placement: nextPlacements,
      public_display_name: publicDisplayName,
      reviewed_by: auth.user!.id,
      reviewed_at: now,
      updated_at: now,
      published_at: nextPublished
        ? existing.is_published
          ? undefined
          : now
        : null,
    };

    if (editedContent !== undefined) {
      update.admin_edited_content = editedContent;
    }

    if (internalNote !== undefined) {
      update.internal_note = internalNote || null;
    }

    const { data: updated, error: updateError } = await db
      .from("student_feedback")
      .update(update)
      .eq("id", body.id)
      .select(
        "id, feedback_type, course_id, rating, content, public_consent, status, is_published, admin_edited_content, public_display_name, display_placement, internal_note, reviewed_at, published_at, updated_at"
      )
      .single();

    if (updateError || !updated) {
      console.error("Feedback moderation update failed:", updateError);

      return NextResponse.json(
        { error: "Could not save the moderation changes." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      feedback: updated,
      message: nextPublished
        ? "Feedback approved and published."
        : nextStatus === "rejected"
          ? "Feedback rejected and kept unpublished."
          : "Feedback moderation changes saved.",
    });
  } catch (error) {
    console.error("Feedback moderation request failed:", error);

    return NextResponse.json(
      { error: "An unexpected error occurred while moderating feedback." },
      { status: 500 }
    );
  }
}
