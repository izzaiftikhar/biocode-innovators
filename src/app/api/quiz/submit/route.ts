import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getSessionUser, isAdmin } from "@/lib/auth/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function requireAdmin() {
  const user = await getSessionUser();

  if (!user) {
    return NextResponse.json(
      { error: "Please sign in." },
      { status: 401 },
    );
  }

  if (!(await isAdmin(user.id))) {
    return NextResponse.json(
      { error: "Only an admin can do this." },
      { status: 403 },
    );
  }

  return null;
}

/** Lists attempt history and retake requests for a course. */
export async function GET(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const courseId = new URL(req.url).searchParams.get("courseId");

  if (!courseId) {
    return NextResponse.json(
      { error: "courseId is required." },
      { status: 400 },
    );
  }

  const db = createServerSupabase();

  const [
    { data: attempts, error: attemptsError },
    { data: requests, error: requestsError },
  ] = await Promise.all([
    db
      .from("quiz_attempts")
      .select(
        "id, user_id, course_id, attempt_number, score, total, percent, passed, created_at",
      )
      .eq("course_id", courseId)
      .order("created_at", { ascending: false }),

    db
      .from("quiz_retake_requests")
      .select(
        "id, attempt_id, user_id, course_id, reason, status, requested_at, reviewed_at, reviewed_by, admin_note, approved_attempt_number, consumed_at",
      )
      .eq("course_id", courseId)
      .order("requested_at", { ascending: false }),
  ]);

  if (attemptsError || requestsError) {
    console.error("Admin quiz history lookup failed:", {
      attemptsError,
      requestsError,
    });

    return NextResponse.json(
      { error: "Could not load quiz history and retake requests." },
      { status: 500 },
    );
  }

  const ids = Array.from(
    new Set([
      ...(attempts ?? []).map((attempt) => attempt.user_id),
      ...(requests ?? []).map((request) => request.user_id),
    ]),
  );

  const { data: profiles, error: profilesError } = ids.length
    ? await db
        .from("profiles")
        .select("id, full_name")
        .in("id", ids)
    : {
        data: [] as { id: string; full_name: string | null }[],
        error: null,
      };

  if (profilesError) {
    console.error("Admin quiz profile lookup failed:", profilesError);

    return NextResponse.json(
      { error: "Could not load student names." },
      { status: 500 },
    );
  }

  const names = new Map(
    (profiles ?? []).map((profile) => [
      profile.id,
      profile.full_name,
    ]),
  );

  return NextResponse.json({
    attempts: (attempts ?? []).map((attempt) => ({
      ...attempt,
      name: names.get(attempt.user_id) || "Unnamed student",
    })),

    requests: (requests ?? []).map((request) => ({
      ...request,
      name: names.get(request.user_id) || "Unnamed student",
    })),
  });
}

/** Approves or rejects a retake request without deleting attempt history. */
export async function POST(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const user = await getSessionUser();

  if (!user) {
    return NextResponse.json(
      { error: "Please sign in." },
      { status: 401 },
    );
  }

  const body = (await req.json().catch(() => null)) as {
    requestId?: unknown;
    decision?: unknown;
    adminNote?: unknown;
  } | null;

  if (
    !body ||
    typeof body.requestId !== "string" ||
    !body.requestId.trim() ||
    (body.decision !== "approved" && body.decision !== "rejected")
  ) {
    return NextResponse.json(
      { error: "A valid request ID and decision are required." },
      { status: 400 },
    );
  }

  if (
    body.adminNote !== undefined &&
    body.adminNote !== null &&
    typeof body.adminNote !== "string"
  ) {
    return NextResponse.json(
      { error: "The admin note must be text." },
      { status: 400 },
    );
  }

  const adminNote =
    typeof body.adminNote === "string"
      ? body.adminNote.trim()
      : null;

  if (adminNote && adminNote.length > 2000) {
    return NextResponse.json(
      { error: "The admin note cannot exceed 2000 characters." },
      { status: 400 },
    );
  }

  const db = createServerSupabase();

  const { data, error } = await db.rpc(
    "review_quiz_retake_request",
    {
      p_request_id: body.requestId.trim(),
      p_admin_id: user.id,
      p_decision: body.decision,
      p_admin_note: adminNote || null,
    },
  );

  if (error) {
    console.error("Retake request review failed:", error);

    return NextResponse.json(
      { error: "Could not review this retake request." },
      { status: 500 },
    );
  }

  const result = data as {
    status?: string;
    message?: string;
  } | null;

  if (
    result?.status &&
    !["approved", "rejected"].includes(result.status)
  ) {
    return NextResponse.json(
      {
        error:
          result.message ||
          "This request could not be reviewed. It may already have been handled.",
        status: result.status,
      },
      { status: 409 },
    );
  }

  return NextResponse.json({
    ok: true,
    status: result?.status ?? body.decision,
    message:
      result?.message ??
      `Retake request ${body.decision}.`,
  });
}
