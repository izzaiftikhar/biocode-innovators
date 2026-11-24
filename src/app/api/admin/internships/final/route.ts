import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getSessionUser, isAdmin } from "@/lib/auth/server";
import { notifyFinalReviewed } from "@/lib/internships/notify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const fail = (error: string, status = 400) =>
  NextResponse.json({ error }, { status });

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) return fail("Please sign in.", 401);
    if (!(await isAdmin(user.id))) return fail("Admins only.", 403);

    const db = createServerSupabase();
    const { data, error } = await db
      .from("internship_final_submissions")
      .select("*")
      .order("submitted_at", { ascending: false });

    if (error) {
      console.error("Final submissions load failed:", error);
      return fail("Could not load submissions.", 500);
    }

    return NextResponse.json({ submissions: data ?? [] });
  } catch (error) {
    console.error("Final submissions load failed:", error);
    return fail("An unexpected error occurred.", 500);
  }
}

export async function POST(req: Request) {
  try {
    const user = await getSessionUser();
    if (!user) return fail("Please sign in.", 401);
    if (!(await isAdmin(user.id))) return fail("Admins only.", 403);

    const body = (await req.json().catch(() => null)) as {
      submissionId?: unknown;
      decision?: unknown;
      score?: unknown;
      feedback?: unknown;
    } | null;

    const feedback =
      typeof body?.feedback === "string" ? body.feedback.trim() : "";
    const score =
      body?.score === null || body?.score === undefined || body?.score === ""
        ? null
        : Number(body.score);

    if (
      !body ||
      typeof body.submissionId !== "string" ||
      (body.decision !== "approved" && body.decision !== "needs_revision") ||
      feedback.length > 2000 ||
      (score !== null && (!Number.isInteger(score) || score < 0 || score > 100))
    ) {
      return fail("Invalid review. Score must be a whole number from 0 to 100.");
    }

    if (body.decision === "needs_revision" && !feedback) {
      return fail("Explain what the student needs to correct.");
    }

    const db = createServerSupabase();
    const { data, error } = await db
      .from("internship_final_submissions")
      .update({
        status: body.decision,
        score,
        feedback: feedback || null,
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", body.submissionId)
      .select("id")
      .maybeSingle();

    if (error) {
      console.error("Final review failed:", error);
      return fail("Could not save the review.", 500);
    }
    if (!data) return fail("Submission not found.", 404);

    await notifyFinalReviewed(db, body.submissionId);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Final review failed:", error);
    return fail("An unexpected error occurred.", 500);
  }
}
