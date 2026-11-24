import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getSessionUser, isAdmin } from "@/lib/auth/server";

export const runtime = "nodejs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_PROMPT = 1000;
const MAX_OPTION = 300;
const MAX_OPTIONS = 6;

async function requireAdmin() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  if (!(await isAdmin(user.id))) {
    return NextResponse.json({ error: "Only an admin can do this." }, { status: 403 });
  }
  return null;
}

function bad(error: string, status = 400) {
  return NextResponse.json({ error }, { status });
}

function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}

/** Validates and cleans a question payload. Returns an error string or the clean value. */
function cleanQuestion(input: unknown):
  | { error: string }
  | { prompt: string; options: string[]; correct_index: number } {
  const q = input as { prompt?: unknown; options?: unknown; correctIndex?: unknown } | null;
  if (!q || typeof q.prompt !== "string" || !q.prompt.trim()) return { error: "Write the question." };
  if (q.prompt.trim().length > MAX_PROMPT) return { error: "The question is too long." };
  if (!Array.isArray(q.options)) return { error: "Options are required." };

  const options: string[] = [];
  let correct = -1;
  q.options.forEach((raw, index) => {
    if (typeof raw !== "string" || !raw.trim()) return;
    if (index === q.correctIndex) correct = options.length;
    options.push(raw.trim().slice(0, MAX_OPTION));
  });

  if (options.length < 2) return { error: "Enter at least two answer options." };
  if (options.length > MAX_OPTIONS) return { error: `Use at most ${MAX_OPTIONS} options.` };
  if (correct === -1) return { error: "Mark the correct answer, and make sure that option is not empty." };
  return { prompt: q.prompt.trim(), options, correct_index: correct };
}

/**
 * GET                    -> list of courses
 * GET ?courseId=<uuid>   -> quiz settings + questions (with answers, admin only)
 */
export async function GET(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const db = createServerSupabase();
  const courseId = new URL(req.url).searchParams.get("courseId");

  if (!courseId) {
    const { data, error } = await db.from("courses").select("id, title").order("title");
    if (error) {
      console.error("Admin quiz: course list failed:", error.message);
      return bad("Could not load courses.", 500);
    }
    return NextResponse.json({ courses: data ?? [] });
  }

  if (!isUuid(courseId)) return bad("Invalid course.");

  const [quiz, questions] = await Promise.all([
    db.from("course_quizzes").select("published, pass_percent").eq("course_id", courseId).maybeSingle(),
    db.from("quiz_questions")
      .select("id, position, prompt, options, correct_index")
      .eq("course_id", courseId)
      .order("position")
      .order("created_at"),
  ]);

  if (quiz.error || questions.error) {
    console.error("Admin quiz: load failed:", quiz.error?.message || questions.error?.message);
    return bad("Could not load the quiz.", 500);
  }

  return NextResponse.json({
    published: !!quiz.data?.published,
    passPercent: quiz.data?.pass_percent ?? 90,
    questions: questions.data ?? [],
  });
}

/**
 * POST { action, courseId, ... }
 *   save_settings   { passPercent, published }
 *   create_question { prompt, options, correctIndex }
 *   update_question { questionId, prompt, options, correctIndex }
 *   delete_question { questionId }
 */
export async function POST(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body.action !== "string") return bad("Invalid request.");
  if (!isUuid(body.courseId)) return bad("Invalid course.");

  const courseId = body.courseId;
  const db = createServerSupabase();

  const { data: course, error: courseError } = await db
    .from("courses").select("id").eq("id", courseId).maybeSingle();
  if (courseError) return bad("Could not verify the course.", 500);
  if (!course) return bad("Course not found.", 404);

  switch (body.action) {
    case "save_settings": {
      const pass = body.passPercent;
      if (typeof pass !== "number" || !Number.isInteger(pass) || pass < 1 || pass > 100) {
        return bad("The pass mark must be a whole number from 1 to 100.");
      }
      if (typeof body.published !== "boolean") return bad("Invalid request.");

      if (body.published) {
        const { count, error } = await db
          .from("quiz_questions").select("id", { count: "exact", head: true }).eq("course_id", courseId);
        if (error) return bad("Could not verify the questions.", 500);
        if (!count) return bad("Add at least one question before publishing the quiz.");
      }

      const { error } = await db.from("course_quizzes").upsert(
        { course_id: courseId, pass_percent: pass, published: body.published, updated_at: new Date().toISOString() },
        { onConflict: "course_id" },
      );
      if (error) {
        console.error("Admin quiz: save settings failed:", error.message);
        return bad("Could not save the settings.", 500);
      }
      return NextResponse.json({ ok: true });
    }

    case "create_question":
    case "update_question": {
      const clean = cleanQuestion(body);
      if ("error" in clean) return bad(clean.error);

      if (body.action === "create_question") {
        const { data: last, error: lastError } = await db
          .from("quiz_questions").select("position").eq("course_id", courseId)
          .order("position", { ascending: false }).limit(1).maybeSingle();
        if (lastError) return bad("Could not add the question.", 500);

        const { error } = await db.from("quiz_questions").insert({
          ...clean, course_id: courseId, position: (last?.position ?? 0) + 1,
        });
        if (error) {
          console.error("Admin quiz: create question failed:", error.message);
          return bad("Could not add the question.", 500);
        }
        return NextResponse.json({ ok: true });
      }

      if (!isUuid(body.questionId)) return bad("Invalid question.");
      // Scoped to the course so an ID from another course can never be edited here.
      const { data, error } = await db.from("quiz_questions")
        .update(clean).eq("id", body.questionId).eq("course_id", courseId).select("id");
      if (error) {
        console.error("Admin quiz: update question failed:", error.message);
        return bad("Could not update the question.", 500);
      }
      if (!data?.length) return bad("Question not found.", 404);
      return NextResponse.json({ ok: true });
    }

    case "delete_question": {
      if (!isUuid(body.questionId)) return bad("Invalid question.");
      const { data, error } = await db.from("quiz_questions")
        .delete().eq("id", body.questionId).eq("course_id", courseId).select("id");
      if (error) {
        console.error("Admin quiz: delete question failed:", error.message);
        return bad("Could not delete the question.", 500);
      }
      if (!data?.length) return bad("Question not found.", 404);

      // A published quiz with no questions would silently stop being required; unpublish it explicitly.
      const { count } = await db
        .from("quiz_questions").select("id", { count: "exact", head: true }).eq("course_id", courseId);
      if (!count) {
        await db.from("course_quizzes").update({ published: false }).eq("course_id", courseId);
        return NextResponse.json({ ok: true, unpublished: true });
      }
      return NextResponse.json({ ok: true });
    }

    default:
      return bad("Unknown action.");
  }
}
