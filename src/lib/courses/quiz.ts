
import type { SupabaseClient } from "@supabase/supabase-js";

export const DEFAULT_PASS_PERCENT = 90;

function throwDatabaseError(message: string, error: unknown): never {
  console.error(message, error);
  throw new Error(message);
}

/** True only when the course has modules and every one is completed. */
export async function allModulesCompleted(
  db: SupabaseClient,
  userId: string,
  courseId: string,
): Promise<boolean> {
  const { data: modules, error: modulesError } = await db
    .from("modules")
    .select("id")
    .eq("course_id", courseId);

  if (modulesError) {
    throwDatabaseError("Could not verify course modules.", modulesError);
  }

  if (!modules?.length) return false;

  const { data: progress, error: progressError } = await db
    .from("module_progress")
    .select("module_id, status")
    .eq("user_id", userId)
    .in("module_id", modules.map((module) => module.id));

  if (progressError) {
    throwDatabaseError("Could not verify module completion.", progressError);
  }

  const completed = new Set(
    (progress ?? [])
      .filter((item) => item.status === "completed")
      .map((item) => item.module_id),
  );

  return modules.every((module) => completed.has(module.id));
}

export type QuizResult = {
  score: number;
  total: number;
  percent: number;
  passed: boolean;
  passPercent: number;
  attemptNumber: number;
};

export type QuizQuestion = {
  id: string;
  prompt: string;
  options: string[];
};

export type QuizState =
  | { state: "not_enrolled" }
  | { state: "modules_incomplete" }
  | { state: "no_quiz" }
  | ({ state: "attempted" } & QuizResult)
  | {
      state: "ready";
      passPercent: number;
      questions: QuizQuestion[];
      attemptNumber: number;
      isRetake: boolean;
    };

/** Returns the student's quiz state without exposing correct answers. */
export async function getQuizState(
  db: SupabaseClient,
  userId: string,
  courseId: string,
): Promise<QuizState> {
  const { data: enrolment, error: enrolmentError } = await db
    .from("enrolments")
    .select("user_id")
    .eq("user_id", userId)
    .eq("course_id", courseId)
    .maybeSingle();

  if (enrolmentError) {
    throwDatabaseError("Could not verify course enrolment.", enrolmentError);
  }

  if (!enrolment) return { state: "not_enrolled" };

  const { data: quiz, error: quizError } = await db
    .from("course_quizzes")
    .select("pass_percent, published")
    .eq("course_id", courseId)
    .maybeSingle();

  if (quizError) {
    throwDatabaseError("Could not load the final quiz.", quizError);
  }

  if (!quiz?.published) return { state: "no_quiz" };

  const { data: questions, error: questionsError } = await db
    .from("quiz_questions")
    .select("id, prompt, options")
    .eq("course_id", courseId)
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });

  if (questionsError) {
    throwDatabaseError("Could not load final quiz questions.", questionsError);
  }

  if (!questions?.length) return { state: "no_quiz" };

  const passPercent =
    typeof quiz.pass_percent === "number"
      ? quiz.pass_percent
      : DEFAULT_PASS_PERCENT;

  const safeQuestions: QuizQuestion[] = questions.map((question) => ({
    id: question.id,
    prompt: question.prompt,
    options: Array.isArray(question.options)
      ? question.options.filter(
          (option): option is string => typeof option === "string",
        )
      : [],
  }));

  const { data: attempt, error: attemptError } = await db
    .from("quiz_attempts")
    .select("score, total, percent, passed, attempt_number")
    .eq("user_id", userId)
    .eq("course_id", courseId)
    .order("attempt_number", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (attemptError) {
    throwDatabaseError("Could not verify the student's quiz attempt.", attemptError);
  }

  // An active session takes priority over any previous completed result.
  const { data: activeSession, error: activeSessionError } = await db
    .from("quiz_sessions")
    .select("id, attempt_number")
    .eq("user_id", userId)
    .eq("course_id", courseId)
    .is("completed_at", null)
    .maybeSingle();

  if (activeSessionError) {
    throwDatabaseError("Could not verify the active quiz session.", activeSessionError);
  }

  if (activeSession) {
    return {
      state: "ready",
      passPercent,
      questions: safeQuestions,
      attemptNumber: activeSession.attempt_number ?? 1,
      isRetake: (activeSession.attempt_number ?? 1) > 1,
    };
  }

  // A completed attempt unlocks self-service retakes.
  // No new module completion or admin approval is required.
  if (attempt) {
    return {
      state: "attempted",
      score: attempt.score,
      total: attempt.total,
      percent: attempt.percent,
      passed: attempt.passed,
      passPercent,
      attemptNumber: attempt.attempt_number ?? 1,
    };
  }

  // Module completion is required only for the first attempt.
  if (!(await allModulesCompleted(db, userId, courseId))) {
    return { state: "modules_incomplete" };
  }

  return {
    state: "ready",
    passPercent,
    questions: safeQuestions,
    attemptNumber: 1,
    isRetake: false,
  };
}
/**
 * Determines whether a published final quiz is required for a certificate.
 * The latest attempt determines whether the requirement has been passed.
 * Previous attempts are never modified.
 */
export async function quizRequirement(
  db: SupabaseClient,
  userId: string,
  courseId: string,
): Promise<{
  required: boolean;
  attempted: boolean;
  passed: boolean;
}> {
  const { data: quiz, error: quizError } = await db
    .from("course_quizzes")
    .select("published")
    .eq("course_id", courseId)
    .maybeSingle();

  if (quizError) {
    throwDatabaseError("Could not verify the course quiz requirement.", quizError);
  }

  if (!quiz?.published) {
    return { required: false, attempted: false, passed: false };
  }

  const { count, error: questionsError } = await db
    .from("quiz_questions")
    .select("id", { count: "exact", head: true })
    .eq("course_id", courseId);

  if (questionsError) {
    throwDatabaseError("Could not verify the course quiz questions.", questionsError);
  }

  if (!count) {
    return { required: false, attempted: false, passed: false };
  }

  const { data: attempt, error: attemptError } = await db
    .from("quiz_attempts")
    .select("passed")
    .eq("user_id", userId)
    .eq("course_id", courseId)
    .order("attempt_number", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (attemptError) {
    throwDatabaseError("Could not verify the latest quiz result.", attemptError);
  }

  return {
    required: true,
    attempted: Boolean(attempt),
    passed: attempt?.passed === true,
  };
}
