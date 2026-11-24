import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BUCKET = "internship-files";
// Vercel serverless request bodies are limited to about 4.5 MB.
const MAX_BYTES = 4 * 1024 * 1024;
const UTC_OFFSET = process.env.DEADLINE_UTC_OFFSET ?? "+05:00";

const fail = (error: string, status = 400) =>
  NextResponse.json({ error }, { status });

function isZip(bytes: Uint8Array, name: string) {
  return (
    name.toLowerCase().endsWith(".zip") &&
    bytes.length > 4 &&
    bytes[0] === 0x50 &&
    bytes[1] === 0x4b &&
    bytes[2] === 0x03 &&
    bytes[3] === 0x04
  );
}

export async function POST(req: Request) {
  try {
    const user = await getSessionUser();
    if (!user) return fail("Please sign in.", 401);

    const form = await req.formData().catch(() => null);
    if (!form) return fail("Invalid request.");

    const enrollmentId = String(form.get("enrollmentId") ?? "").trim();
    const linkUrl = String(form.get("linkUrl") ?? "").trim();
    const notes = String(form.get("notes") ?? "").trim().slice(0, 1000);
    const raw = form.get("file");
    const file = raw instanceof File && raw.size > 0 ? raw : null;

    if (!enrollmentId) return fail("Invalid request.");

    if (!file && !linkUrl) {
      return fail(
        "Upload one combined ZIP with all your tasks, or paste a GitHub / live link."
      );
    }

    if (linkUrl) {
      let parsed: URL | null = null;
      try {
        parsed = new URL(linkUrl);
      } catch {
        parsed = null;
      }
      if (
        !parsed ||
        !["http:", "https:"].includes(parsed.protocol) ||
        linkUrl.length > 500
      ) {
        return fail("Please enter a valid link starting with https://");
      }
    }

    const db = createServerSupabase();

    const { data: enrollment } = await db
      .from("internship_enrollments")
      .select("id, internship_id, status")
      .eq("id", enrollmentId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!enrollment) return fail("Enrollment not found.", 404);
    if (enrollment.status !== "active") {
      return fail("This internship is no longer active.", 403);
    }

    const { data: internship } = await db
      .from("internships")
      .select("end_date")
      .eq("id", enrollment.internship_id)
      .maybeSingle();

    if (internship?.end_date) {
      const dueAt = new Date(
        `${internship.end_date}T23:59:59${UTC_OFFSET}`
      ).getTime();

      if (Date.now() > dueAt) {
        return fail(
          "The submission deadline for this internship has passed.",
          403
        );
      }
    }

    const { data: existing } = await db
      .from("internship_final_submissions")
      .select("id, status, version, file_path")
      .eq("enrollment_id", enrollment.id)
      .maybeSingle();

    if (existing?.status === "approved") {
      return fail("Your submission is already approved.", 409);
    }

    let uploadPath: string | null = null;

    if (file) {
      if (file.size > MAX_BYTES) {
        return fail(
          "The ZIP must be smaller than 4 MB. For larger projects, upload to GitHub and paste the link."
        );
      }

      const bytes = new Uint8Array(await file.arrayBuffer());
      if (!isZip(bytes, file.name)) return fail("Only a valid ZIP file is accepted.");

      uploadPath = `${user.id}/submissions/${enrollment.id}/final-${Date.now()}.zip`;

      const { error: uploadError } = await db.storage
        .from(BUCKET)
        .upload(uploadPath, bytes, { contentType: "application/zip", upsert: false });

      if (uploadError) {
        console.error("Submission upload failed:", uploadError);
        return fail("Could not upload your file. Please try again.", 500);
      }
    }

    const fields = {
      file_path: uploadPath,
      link_url: linkUrl || null,
      notes: notes || null,
      status: "submitted",
      score: null,
      feedback: null,
      reviewed_by: null,
      reviewed_at: null,
      submitted_at: new Date().toISOString(),
      is_late: false,
    };

    const { error: saveError } = existing
      ? await db
          .from("internship_final_submissions")
          .update({ ...fields, version: existing.version + 1 })
          .eq("id", existing.id)
      : await db
          .from("internship_final_submissions")
          .insert({ enrollment_id: enrollment.id, ...fields, version: 1 });

    if (saveError) {
      if (uploadPath) await db.storage.from(BUCKET).remove([uploadPath]);
      console.error("Submission save failed:", saveError);

      if (saveError.message?.includes("end date")) {
        return fail("The submission deadline for this internship has passed.", 403);
      }
      return fail(
        saveError.code === "23505"
          ? "A submission was just saved. Refresh the page."
          : "Could not save your submission. Please try again.",
        saveError.code === "23505" ? 409 : 500
      );
    }

    if (existing?.file_path) {
      await db.storage.from(BUCKET).remove([existing.file_path]);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Internship submission failed:", error);
    return fail("Could not process your submission. Please try again.", 500);
  }
}
