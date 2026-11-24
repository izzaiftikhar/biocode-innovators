
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
      { status: 401 }
    );
  }

  if (!(await isAdmin(user.id))) {
    return NextResponse.json(
      { error: "Only an admin can do this." },
      { status: 403 }
    );
  }

  return null;
}

type ReviewResult = {
  status?: string;
  decision?: string;
  approved_attempt_number?: number | null;
};

export async function GET(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const courseId = new URL(req.url).searchParams.get("courseId");

  if (!courseId) {
    return NextResponse.json(
      { error: "courseId is required." },
      { status: 400 }
    );
  }

  const db = createServerSupabase();

  const [attemptResult, requestResult] = await Promise.all([
    db
      .from("quiz_attempts")
      .select(
        "id, user_id, course_id, attempt_number, score, total, percent, passed, created_at"
      )
      .eq("course_id", courseId)
      .order("attempt_number", { ascending: false })
      .order("created_at", { ascending: false }),

    db
      .from("quiz_retake_requests")
      .select(
        "id, attempt_id, user_id, course_id, reason, status, requested_at, reviewed_at, reviewed_by, admin_note, approved_attempt_number, consumed_at"
      )
      .eq("course_id", courseId)
      .order("requested_at", { ascending: false }),
  ]);

  if (attemptResult.error || requestResult.error) {
    console.error(
      "Admin quiz history error:",
      attemptResult.error || requestResult.error
    );

    return NextResponse.json(
      { error: "Could not load quiz attempts and retake requests." },
      { status: 500 }
    );
  }

  const ids = Array.from(
    new Set([
      ...(attemptResult.data ?? []).map((item) => item.user_id),
      ...(requestResult.data ?? []).map((item) => item.user_id),
    ])
  );

  const { data: profiles, error: profileError } = ids.length
    ? await db.from("profiles").select("id, full_name").in("id", ids)
    : { data: [], error: null };

  if (profileError) {
    console.error("Could not load student profiles:", profileError);
  }

  const names = new Map(
    (profiles ?? []).map((profile) => [
      profile.id,
      profile.full_name || "Unnamed student",
    ])
  );

  return NextResponse.json({
    attempts: (attemptResult.data ?? []).map((attempt) => ({
      ...attempt,
      name: names.get(attempt.user_id) || "Unnamed student",
    })),

    requests: (requestResult.data ?? []).map((request) => ({
      ...request,
      name: names.get(request.user_id) || "Unnamed student",
    })),
  });
}

export async function POST(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const body = (await req.json().catch(() => null)) as {
    requestId?: unknown;
    decision?: unknown;
    adminNote?: unknown;
  } | null;

  if (
    !body ||
    typeof body.requestId !== "string" ||
    typeof body.decision !== "string"
  ) {
    return NextResponse.json(
      { error: "Invalid retake review request." },
      { status: 400 }
    );
  }

  const requestId = body.requestId.trim();
  const decision = body.decision.trim();

  const uuidPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  if (!uuidPattern.test(requestId)) {
    return NextResponse.json(
      { error: "Invalid retake request ID." },
      { status: 400 }
    );
  }

  if (decision !== "approved" && decision !== "rejected") {
    return NextResponse.json(
      { error: "Decision must be approved or rejected." },
      { status: 400 }
    );
  }

  const adminNote =
    typeof body.adminNote === "string" ? body.adminNote.trim() : "";

  if (adminNote.length > 2000) {
    return NextResponse.json(
      { error: "Admin note cannot exceed 2000 characters." },
      { status: 400 }
    );
  }

  const admin = await getSessionUser();
  if (!admin) {
    return NextResponse.json(
      { error: "Please sign in." },
      { status: 401 }
    );
  }

  const db = createServerSupabase();

  const { data, error } = await db.rpc("review_quiz_retake_request", {
    p_request_id: requestId,
    p_admin_id: admin.id,
    p_decision: decision,
    p_admin_note: adminNote || null,
  });

  if (error) {
    console.error("Retake review RPC failed:", error);

    return NextResponse.json(
      { error: "Could not review this retake request." },
      { status: 500 }
    );
  }

  const result = data as ReviewResult;

  if (
    result?.status === "approved" ||
    result?.status === "rejected"
  ) {
    return NextResponse.json({
      status: result.status,
      approvedAttemptNumber: result.approved_attempt_number ?? null,
      message:
        result.status === "approved"
          ? "Retake request approved. The student can start a new attempt."
          : "Retake request rejected.",
    });
  }

  const messages: Record<string, string> = {
    not_found: "Retake request not found.",
    already_reviewed: "This request has already been reviewed.",
    stale_request: "This request is no longer eligible for approval.",
    active_session: "The student already has an active quiz session.",
    invalid_decision: "Invalid review decision.",
    invalid_request: "Invalid retake request.",
    note_too_long: "Admin note is too long.",
  };

  const status = result?.status || "unknown";

  return NextResponse.json(
    {
      status,
      error: messages[status] || "Could not process this retake request.",
    },
    { status: status === "not_found" ? 404 : 409 }
  );
}
