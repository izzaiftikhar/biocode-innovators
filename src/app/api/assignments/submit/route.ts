import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerSupabase } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth/server";
import { getWatchStatus } from "@/lib/courses/watch";

export const runtime = "nodejs";

const BUCKET = "course-assignments";
const MAX_FILE_SIZE = 50 * 1024 * 1024;

/**
 * Deadlines are saved by the admin form as a "datetime-local" string with no
 * timezone (e.g. 2026-10-30T23:59). Interpret them in the academy's timezone,
 * not the server's (Vercel runs in UTC). Override with DEADLINE_UTC_OFFSET.
 */
function parseDeadline(value: unknown): number | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const v = value.trim();
  if (/([zZ]|[+-]\d{2}:?\d{2})$/.test(v)) {
    const ms = new Date(v).getTime();
    return Number.isNaN(ms) ? null : ms;
  }
  const offset = process.env.DEADLINE_UTC_OFFSET ?? "+05:00";
  const base =
    v.length === 10 ? `${v}T23:59:59` : v.length === 16 ? `${v}:00` : v;
  const ms = new Date(`${base}${offset}`).getTime();
  return Number.isNaN(ms) ? null : ms;
}

type Eligibility =
  | { ok: false; status: number; error: string }
  | { ok: true; moduleId: string };

/** Every rule that decides whether this student may submit this assignment right now. */
async function checkEligibility(
  db: SupabaseClient,
  userId: string,
  assignmentId: string
): Promise<Eligibility> {
  const { data: assignment, error: assignmentError } = await db
    .from("assignments")
    .select("id, module_id, config")
    .eq("id", assignmentId)
    .maybeSingle();

  if (assignmentError) {
    console.error("Assignment lookup failed:", assignmentError);
    return { ok: false, status: 500, error: "Could not load this assignment." };
  }
  if (!assignment) {
    return { ok: false, status: 404, error: "Assignment not found." };
  }

  const { data: module } = await db
    .from("modules")
    .select("id, course_id, youtube_id")
    .eq("id", assignment.module_id)
    .maybeSingle();

  if (!module) {
    return { ok: false, status: 404, error: "Module not found." };
  }

  const { data: course } = await db
    .from("courses")
    .select("published")
    .eq("id", module.course_id)
    .maybeSingle();

  if (!course?.published) {
    return { ok: false, status: 404, error: "This course is not available." };
  }

  // 1. The module must be unlocked for this student.
  const { data: access } = await db
    .from("module_progress")
    .select("status")
    .eq("user_id", userId)
    .eq("module_id", module.id)
    .maybeSingle();

  if (!access || access.status === "locked") {
    return {
      ok: false,
      status: 403,
      error: "This module is locked. Complete the previous module first.",
    };
  }

  // 2. The lecture must be watched to the required threshold (server-measured).
  const watch = await getWatchStatus(db, userId, module.id, module.youtube_id);
  if (!watch.met) {
    return {
      ok: false,
      status: 403,
      error:
        "Watch at least 90% of the lecture before submitting this assignment. Your progress is saved automatically.",
    };
  }

  // 3. Approved work is final; otherwise check the deadline.
  const { data: latest } = await db
    .from("submissions")
    .select("review_status")
    .eq("user_id", userId)
    .eq("assignment_id", assignmentId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latest?.review_status === "approved") {
    return {
      ok: false,
      status: 409,
      error: "This assignment is already approved.",
    };
  }

  const config = (assignment.config ?? {}) as { deadline?: string };
  const deadline = parseDeadline(config.deadline);

  // An admin who requests changes is explicitly re-opening the assignment.
  if (
    deadline !== null &&
    Date.now() > deadline &&
    latest?.review_status !== "changes_requested"
  ) {
    return {
      ok: false,
      status: 403,
      error: "The deadline for this assignment has passed.",
    };
  }

  return { ok: true, moduleId: module.id };
}

function safeName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-180) || "file";
}

export async function POST(req: Request) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json(
        { error: "Please sign in before submitting your assignment." },
        { status: 401 }
      );
    }

    const body = (await req.json().catch(() => null)) as {
      action?: unknown;
      assignmentId?: unknown;
      fileName?: unknown;
      fileSize?: unknown;
      filePath?: unknown;
    } | null;

    if (
      !body ||
      typeof body.assignmentId !== "string" ||
      !body.assignmentId ||
      (body.action !== "prepare" && body.action !== "finalize")
    ) {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }

    const db = createServerSupabase();
    const assignmentId = body.assignmentId;

    // ---------- Step 1: check the rules, then issue a one-time upload slot ----------
    if (body.action === "prepare") {
      if (
        typeof body.fileName !== "string" ||
        !body.fileName.trim() ||
        typeof body.fileSize !== "number" ||
        !Number.isFinite(body.fileSize) ||
        body.fileSize <= 0
      ) {
        return NextResponse.json(
          { error: "A file is required." },
          { status: 400 }
        );
      }
      if (body.fileSize > MAX_FILE_SIZE) {
        return NextResponse.json(
          { error: "The file must be 50 MB or smaller." },
          { status: 400 }
        );
      }

      const eligibility = await checkEligibility(db, user.id, assignmentId);
      if (!eligibility.ok) {
        return NextResponse.json(
          { error: eligibility.error },
          { status: eligibility.status }
        );
      }

      const path = `submissions/${user.id}/${assignmentId}/${Date.now()}-${safeName(
        body.fileName
      )}`;

      const { data, error } = await db.storage
        .from(BUCKET)
        .createSignedUploadUrl(path);

      if (error || !data?.token) {
        console.error("Signed upload URL failed:", error);
        return NextResponse.json(
          { error: "Could not prepare the upload. Please try again." },
          { status: 500 }
        );
      }

      return NextResponse.json({ path, token: data.token });
    }

    // ---------- Step 2: confirm the upload happened, then record the submission ----------
    if (typeof body.filePath !== "string" || !body.filePath) {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }

    const filePath = body.filePath;
    const folder = `submissions/${user.id}/${assignmentId}`;

    // The path must be inside this student's own folder for this assignment.
    if (!filePath.startsWith(`${folder}/`) || filePath.includes("..")) {
      return NextResponse.json({ error: "Invalid file path." }, { status: 400 });
    }

    const removeUpload = async () => {
      const { error } = await db.storage.from(BUCKET).remove([filePath]);
      if (error) console.error("Could not remove rejected upload:", error);
    };

    // Re-check the rules: the student could have waited, or the deadline could have passed.
    const eligibility = await checkEligibility(db, user.id, assignmentId);
    if (!eligibility.ok) {
      await removeUpload();
      return NextResponse.json(
        { error: eligibility.error },
        { status: eligibility.status }
      );
    }

    const fileName = filePath.slice(folder.length + 1);
    const { data: found, error: listError } = await db.storage
      .from(BUCKET)
      .list(folder, { search: fileName, limit: 5 });

    if (listError || !found?.some((f) => f.name === fileName)) {
      return NextResponse.json(
        { error: "The uploaded file could not be found. Please upload again." },
        { status: 400 }
      );
    }

    const { data: existing } = await db
      .from("submissions")
      .select("id")
      .eq("user_id", user.id)
      .eq("file_path", filePath)
      .maybeSingle();

    if (!existing) {
      const { error: insertError } = await db.from("submissions").insert({
        user_id: user.id,
        assignment_id: assignmentId,
        file_path: filePath,
        score: null,
        mentor_comment: null,
        review_status: "pending",
      });

      if (insertError) {
        console.error("Submission insert failed:", insertError);
        await removeUpload();
        return NextResponse.json(
          { error: "Could not save your submission. Please try again." },
          { status: 500 }
        );
      }
    }

    // Reflect the new state on the module (never downgrade a completed module).
    await db
      .from("module_progress")
      .update({ status: "submitted" })
      .eq("user_id", user.id)
      .eq("module_id", eligibility.moduleId)
      .in("status", ["unlocked", "under_review"]);

    return NextResponse.json({ ok: true, filePath });
  } catch (error) {
    console.error("Assignment submit failed:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred. Please try again." },
      { status: 500 }
    );
  }
}
