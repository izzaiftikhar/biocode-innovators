import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth/server";
import { getQuizState } from "@/lib/courses/quiz";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RpcState = {
  status?: string;
  session_id?: string;
  attempt_number?: number;
  current_index?: number;
  remaining_seconds?: number;
  total?: number;
  question?: {
    id: string;
    prompt: string;
    options: string[];
  };
  result?: {
    score: number;
    total: number;
    percent: number;
    passed: boolean;
    passPercent?: number;
    pass_percent?: number;
  };
};

type SessionRow = {
  id: string;
  attempt_number: number;
  completed_at: string | null;
};

function startError(status: string) {
  const messages: Record<string, string> = {
    invalid_request: "Invalid quiz request.",
    no_quiz: "This quiz is not currently published.",
    no_questions: "This quiz has no questions.",
    invalid_questions:
      "The quiz contains invalid questions. Please contact BioCode.",
    session_conflict:
      "A quiz session is already being created. Please refresh and try again.",
  };

  return NextResponse.json(
    {
      error: messages[status] ?? "Could not start your quiz.",
      status,
    },
    {
      status: status === "session_conflict" ? 409 : 400,
    },
  );
}

async function getSessionState(
  db: ReturnType<typeof createServerSupabase>,
  userId: string,
  courseId: string,
  sessionId: string,
) {
  const { data, error } = await db.rpc(
    "get_quiz_session_state_v2",
    {
      p_user_id: userId,
      p_course_id: courseId,
      p_session_id: sessionId,
    },
  );

  if (error) {
    console.error("Quiz session state lookup failed:", error);
    throw new Error("Could not synchronize the quiz session.");
  }

  return data as RpcState;
}

async function completedResponse(
  db: ReturnType<typeof createServerSupabase>,
  userId: string,
  courseId: string,
  sessionId: string,
) {
  const state = await getSessionState(
    db,
    userId,
    courseId,
    sessionId,
  );

  if (state.status !== "completed" || !state.result) {
    return NextResponse.json(
      { error: "The quiz result could not be loaded. Please refresh." },
      { status: 500 },
    );
  }

  return NextResponse.json({
    status: "completed",
    sessionId,
    attemptNumber: state.attempt_number,
    result: {
      ...state.result,
      passPercent:
        state.result.passPercent ??
        state.result.pass_percent ??
        90,
    },
  });
}

async function finalizeSession(
  db: ReturnType<typeof createServerSupabase>,
  userId: string,
  courseId: string,
  sessionId: string,
) {
  const { data, error } = await db.rpc(
    "finalize_quiz_session_v2",
    {
      p_user_id: userId,
      p_course_id: courseId,
      p_session_id: sessionId,
    },
  );

  if (error) {
    console.error("Quiz finalization failed:", error);

    return NextResponse.json(
      { error: "Could not finalize the quiz." },
      { status: 500 },
    );
  }

  const result = data as RpcState;

  if (result?.status === "completed") {
    return completedResponse(db, userId, courseId, sessionId);
  }

  if (result?.status === "waiting") {
    return NextResponse.json(
      {
        status: "waiting",
        remainingSeconds: result.remaining_seconds,
        error: "The question timer has not finished yet.",
      },
      { status: 409 },
    );
  }

  if (result?.status === "not_found") {
    return NextResponse.json(
      { error: "The quiz session could not be found." },
      { status: 404 },
    );
  }

  return NextResponse.json(
    { error: "Could not finalize the quiz. Please contact BioCode." },
    { status: 500 },
  );
}

async function sessionResponse(
  db: ReturnType<typeof createServerSupabase>,
  userId: string,
  courseId: string,
  session: SessionRow,
) {
  const state = await getSessionState(
    db,
    userId,
    courseId,
    session.id,
  );

  if (state.status === "active") {
    return NextResponse.json({
      status: "active",
      sessionId: session.id,
      attemptNumber: state.attempt_number ?? session.attempt_number,
      currentIndex: state.current_index ?? 0,
      total: state.total ?? 0,
      remainingSeconds: state.remaining_seconds ?? 0,
      question: state.question,
    });
  }

  if (state.status === "expired") {
    return finalizeSession(db, userId, courseId, session.id);
  }

  if (state.status === "completed") {
    return completedResponse(db, userId, courseId, session.id);
  }

  return NextResponse.json(
    { error: "Could not synchronize your quiz session. Please refresh." },
    { status: 409 },
  );
}

/**
 * Load the active session, or the latest completed session result.
 * This allows refreshes to resume a quiz or display its saved result.
 */
export async function GET(req: Request) {
  try {
    const user = await getSessionUser();

    if (!user) {
      return NextResponse.json(
        { error: "Please sign in." },
        { status: 401 },
      );
    }

    const courseId = new URL(req.url).searchParams.get("courseId")?.trim();

    if (!courseId) {
      return NextResponse.json(
        { error: "courseId is required." },
        { status: 400 },
      );
    }

    const db = createServerSupabase();

    const { data: active, error: activeError } = await db
      .from("quiz_sessions")
      .select("id, attempt_number, completed_at")
      .eq("user_id", user.id)
      .eq("course_id", courseId)
      .is("completed_at", null)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (activeError) {
      console.error("Active quiz session lookup failed:", activeError);

      return NextResponse.json(
        { error: "Could not load your active quiz session." },
        { status: 500 },
      );
    }

    if (active) {
      return sessionResponse(db, user.id, courseId, active as SessionRow);
    }

    const { data: latest, error: latestError } = await db
      .from("quiz_sessions")
      .select("id, attempt_number, completed_at")
      .eq("user_id", user.id)
      .eq("course_id", courseId)
      .not("completed_at", "is", null)
      .order("completed_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latestError) {
      console.error("Completed quiz session lookup failed:", latestError);

      return NextResponse.json(
        { error: "Could not load your latest quiz result." },
        { status: 500 },
      );
    }

    if (!latest) {
      return NextResponse.json({ status: "not_started" });
    }

    return sessionResponse(db, user.id, courseId, latest as SessionRow);
  } catch (error) {
    console.error("Quiz session GET failed:", error);

    return NextResponse.json(
      { error: "Could not load your quiz session." },
      { status: 500 },
    );
  }
}

/**
 * Resume an existing session or create a new attempt.
 * Only the first attempt requires enrolment and completed modules.
 */
export async function POST(req: Request) {
  try {
    const user = await getSessionUser();

    if (!user) {
      return NextResponse.json(
        { error: "Please sign in." },
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
        { error: "A valid courseId is required." },
        { status: 400 },
      );
    }

    const courseId = body.courseId.trim();
    const db = createServerSupabase();

    // Resume an active attempt instead of creating a duplicate.
    const { data: active, error: activeError } = await db
      .from("quiz_sessions")
      .select("id, attempt_number, completed_at")
      .eq("user_id", user.id)
      .eq("course_id", courseId)
      .is("completed_at", null)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (activeError) {
      console.error("Active quiz session lookup failed:", activeError);

      return NextResponse.json(
        { error: "Could not verify your active quiz session." },
        { status: 500 },
      );
    }

    if (active) {
      return sessionResponse(db, user.id, courseId, active as SessionRow);
    }

    // A previous completed attempt unlocks unlimited retakes.
    // Only a student with no prior attempt must meet first-attempt conditions.
    const { data: previousAttempt, error: attemptError } = await db
      .from("quiz_attempts")
      .select("id")
      .eq("user_id", user.id)
      .eq("course_id", courseId)
      .limit(1)
      .maybeSingle();

    if (attemptError) {
      console.error("Previous quiz attempt lookup failed:", attemptError);

      return NextResponse.json(
        { error: "Could not verify your previous quiz attempts." },
        { status: 500 },
      );
    }

    if (!previousAttempt) {
      const eligibility = await getQuizState(db, user.id, courseId);

      if (eligibility.state === "not_enrolled") {
        return NextResponse.json(
          { error: "You must enrol in this course before taking its quiz." },
          { status: 403 },
        );
      }

      if (eligibility.state === "modules_incomplete") {
        return NextResponse.json(
          { error: "Complete all course modules before taking the final quiz." },
          { status: 403 },
        );
      }

      if (eligibility.state === "no_quiz") {
        return NextResponse.json(
          { error: "This quiz is not currently available." },
          { status: 400 },
        );
      }
    }

    const { data, error } = await db.rpc(
      "start_quiz_session_v2",
      {
        p_user_id: user.id,
        p_course_id: courseId,
      },
    );

    if (error) {
      console.error("Quiz session start failed:", error);

      return NextResponse.json(
        { error: "Could not start your quiz. Please try again." },
        { status: 500 },
      );
    }

    const result = data as RpcState;

    if (
      result?.status !== "started" &&
      result?.status !== "resumed"
    ) {
      return startError(result?.status ?? "unknown");
    }

    if (!result.session_id) {
      return NextResponse.json(
        { error: "The quiz session was created but could not be loaded." },
        { status: 500 },
      );
    }

    return sessionResponse(db, user.id, courseId, {
      id: result.session_id,
      attempt_number: result.attempt_number ?? 1,
      completed_at: null,
    });
  } catch (error) {
    console.error("Quiz session POST failed:", error);

    return NextResponse.json(
      { error: "Could not start your quiz session." },
      { status: 500 },
    );
  }
}
