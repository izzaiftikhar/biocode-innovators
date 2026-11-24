
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RetakeRequestResult = {
  status?: string;
  request_id?: string;
};

export async function POST(request: NextRequest) {
  try {
    const user = await getSessionUser();

    if (!user) {
      return NextResponse.json(
        { error: "Please log in to request a quiz retake." },
        { status: 401 },
      );
    }

    let body: { courseId?: unknown; reason?: unknown };

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid request body." },
        { status: 400 },
      );
    }

    const courseId =
      typeof body.courseId === "string" ? body.courseId.trim() : "";

    const reason =
      typeof body.reason === "string" ? body.reason.trim() : "";

    const uuidPattern =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    if (!uuidPattern.test(courseId)) {
      return NextResponse.json(
        { error: "A valid course is required." },
        { status: 400 },
      );
    }

    if (reason.length < 10 || reason.length > 2000) {
      return NextResponse.json(
        { error: "Your explanation must be between 10 and 2000 characters." },
        { status: 400 },
      );
    }

    const db = createServerSupabase();

    const { data, error } = await db.rpc("request_quiz_retake", {
      p_user_id: user.id,
      p_course_id: courseId,
      p_reason: reason,
    });

    if (error) {
      console.error("Quiz retake request failed:", error);

      return NextResponse.json(
        { error: "Could not submit your retake request. Please try again." },
        { status: 500 },
      );
    }

    const result = data as RetakeRequestResult;

    switch (result?.status) {
      case "submitted":
        return NextResponse.json(
          {
            status: "submitted",
            requestId: result.request_id,
            message: "Your retake request has been submitted for review.",
          },
          { status: 201 },
        );

      case "request_pending":
        return NextResponse.json(
          {
            status: "request_pending",
            message: "You already have a pending retake request.",
          },
          { status: 409 },
        );

      case "already_approved":
        return NextResponse.json(
          {
            status: "already_approved",
            message: "Your retake request has already been approved.",
          },
          { status: 409 },
        );

      case "active_session":
        return NextResponse.json(
          {
            status: "active_session",
            message: "You already have an active quiz session. Resume it instead.",
          },
          { status: 409 },
        );

      case "no_attempt":
        return NextResponse.json(
          {
            error: "No completed quiz attempt was found.",
          },
          { status: 409 },
        );

      case "already_passed":
        return NextResponse.json(
          {
            error: "You have already passed the latest quiz attempt.",
          },
          { status: 409 },
        );

      case "invalid_reason":
        return NextResponse.json(
          {
            error: "Your explanation must be between 10 and 2000 characters.",
          },
          { status: 400 },
        );

      case "invalid_request":
        return NextResponse.json(
          { error: "Invalid retake request." },
          { status: 400 },
        );

      default:
        console.error("Unexpected retake request response:", result);

        return NextResponse.json(
          { error: "The retake request could not be processed." },
          { status: 500 },
        );
    }
  } catch (error) {
    console.error("Retake request API error:", error);

    return NextResponse.json(
      { error: "An unexpected error occurred." },
      { status: 500 },
    );
  }
}
