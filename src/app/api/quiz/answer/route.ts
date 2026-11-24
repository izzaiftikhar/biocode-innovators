
import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth/server";

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
  };
};

type ActiveSession = {
  id: string;
  attempt_number: number;
};

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
    console.error("Quiz state lookup failed:", error);
    throw new Error("Could not synchronize quiz session.");
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

  if (state.status === "completed" && state.result) {
    return NextResponse.json({
      status: "completed",
      sessionId,
      attemptNumber: state.attempt_number,
      result: {
        ...state.result,
        passPercent: state.result.passPercent ?? 90,
      },
    });
  }

  return NextResponse.json(
    { error: "The quiz result could not be loaded. Please contact BioCode." },
    { status: 500 },
  );
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
    return completedResponse(
      db,
      userId,
      courseId,
      sessionId,
    );
  }

  if (result?.status === "waiting") {
    return NextResponse.json(
      {
        status: "waiting",
        remainingSeconds: result.remaining_seconds,
        error: "The quiz timer has not finished yet.",
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

async function advancedResponse(
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

  if (state.status === "active") {
    return NextResponse.json(
      {
        status: "advanced",
        sessionId,
        attemptNumber: state.attempt_number,
        currentIndex: state.current_index,
        total: state.total,
        remainingSeconds: state.remaining_seconds,
        totalSeconds: (state.total ?? 0) * 60,
        question: state.question,
      },
      { status: 409 },
    );
  }

  if (state.status === "expired") {
    return finalizeSession(
      db,
      userId,
      courseId,
      sessionId,
    );
  }

  if (state.status === "completed") {
    return completedResponse(
      db,
      userId,
      courseId,
      sessionId,
    );
  }

  return NextResponse.json(
    { error: "Could not synchronize the quiz. Please refresh." },
    { status: 409 },
  );
}

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
      questionIndex?: unknown;
      answerIndex?: unknown;
    } | null;

    if (
      !body ||
      typeof body.courseId !== "string" ||
      !body.courseId.trim() ||
      !Number.isInteger(body.questionIndex) ||
      !Number.isInteger(body.answerIndex) ||
      (body.questionIndex as number) < 0 ||
      (body.answerIndex as number) < 0
    ) {
      return NextResponse.json(
        { error: "Invalid answer request." },
        { status: 400 },
      );
    }

    const courseId = body.courseId.trim();
    const db = createServerSupabase();

    // Resolve the active session for this authenticated student.
    const { data: session, error: sessionError } = await db
      .from("quiz_sessions")
      .select("id, attempt_number")
      .eq("user_id", user.id)
      .eq("course_id", courseId)
      .is("completed_at", null)
      .maybeSingle();

    if (sessionError) {
      console.error("Active quiz session lookup failed:", sessionError);

      return NextResponse.json(
        { error: "Could not find your active quiz session." },
        { status: 500 },
      );
    }

    if (!session) {
      return NextResponse.json(
        { error: "No active quiz session was found." },
        { status: 404 },
      );
    }

    const activeSession = session as ActiveSession;

    const { data, error } = await db.rpc(
      "record_quiz_session_answer_v2",
      {
        p_user_id: user.id,
        p_course_id: courseId,
        p_session_id: activeSession.id,
        p_question_index: body.questionIndex as number,
        p_answer_index: body.answerIndex as number,
      },
    );

    if (error) {
      console.error("Quiz answer save failed:", error);

      return NextResponse.json(
        { error: "Could not save your answer. Please try again." },
        { status: 500 },
      );
    }

    const state = data as RpcState;

    if (state?.status === "saved") {
      return NextResponse.json({
        status: "saved",
        sessionId: activeSession.id,
        attemptNumber: activeSession.attempt_number,
        currentIndex: state.current_index,
        remainingSeconds: state.remaining_seconds,
      });
    }

    if (
      state?.status === "advanced" ||
      state?.status === "locked"
    ) {
      return advancedResponse(
        db,
        user.id,
        courseId,
        activeSession.id,
      );
    }

    if (state?.status === "expired") {
      return finalizeSession(
        db,
        user.id,
        courseId,
        activeSession.id,
      );
    }

    if (state?.status === "completed") {
      return completedResponse(
        db,
        user.id,
        courseId,
        activeSession.id,
      );
    }

    if (state?.status === "not_found") {
      return NextResponse.json(
        { error: "The quiz session could not be found." },
        { status: 404 },
      );
    }

    if (state?.status === "invalid_answer") {
      return NextResponse.json(
        { error: "That answer is not valid for this question." },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { error: "Could not save this answer." },
      { status: 400 },
    );
  } catch (error) {
    console.error("Quiz answer API failed:", error);

    return NextResponse.json(
      { error: "Could not process your answer." },
      { status: 500 },
    );
  }
}
