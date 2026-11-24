import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BUCKET = "internship-files";
const MAX_BYTES = 4 * 1024 * 1024;

const fail = (error: string, status = 400) =>
  NextResponse.json({ error }, { status });

function imageKind(bytes: Uint8Array): "png" | "jpg" | null {
  if (
    bytes.length > 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return "png";
  }
  if (
    bytes.length > 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  ) {
    return "jpg";
  }
  return null;
}

export async function POST(req: Request) {
  try {
    const user = await getSessionUser();
    if (!user) return fail("Please sign in.", 401);

    const form = await req.formData().catch(() => null);
    if (!form) return fail("Invalid request.");

    const enrollmentId = String(form.get("enrollmentId") ?? "").trim();
    const certificateName = String(form.get("certificateName") ?? "")
      .replace(/\s+/g, " ")
      .trim();
    const transactionId = String(form.get("transactionId") ?? "").trim();
    const confirmName = form.get("confirmName") === "true";
    const raw = form.get("screenshot");
    const screenshot = raw instanceof File && raw.size > 0 ? raw : null;

    if (!enrollmentId) return fail("Invalid request.");

    if (
      certificateName.length < 2 ||
      certificateName.length > 100 ||
      /[<>]/.test(certificateName) ||
      [...certificateName].some((c) => c.charCodeAt(0) < 32)
    ) {
      return fail("Please enter your full name (2 to 100 characters).");
    }

    if (!confirmName) {
      return fail("Please confirm the spelling of the name for your certificate.");
    }

    if (!/^[A-Za-z0-9][A-Za-z0-9\-_/ ]{3,63}$/.test(transactionId)) {
      return fail("Please enter a valid transaction ID (4 to 64 characters).");
    }

    if (!screenshot) return fail("Please upload your payment screenshot.");

    if (screenshot.size > MAX_BYTES) {
      return fail("The screenshot must be smaller than 4 MB.");
    }

    const db = createServerSupabase();

    const { data: enrollment } = await db
      .from("internship_enrollments")
      .select("id, status")
      .eq("id", enrollmentId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!enrollment) return fail("Enrollment not found.", 404);

    const { data: existing } = await db
      .from("internship_payments")
      .select("id, status, screenshot_path")
      .eq("enrollment_id", enrollment.id)
      .maybeSingle();

    if (existing && existing.status !== "rejected") {
      return fail(
        existing.status === "approved"
          ? "Your payment is already approved."
          : "Your payment is already being reviewed.",
        409
      );
    }

    const bytes = new Uint8Array(await screenshot.arrayBuffer());
    const kind = imageKind(bytes);

    if (!kind) return fail("The screenshot must be a PNG or JPEG image.");

    const { data: settings } = await db
      .from("internship_settings")
      .select("certificate_fee")
      .eq("id", 1)
      .maybeSingle();

    const path = `${user.id}/payments/${enrollment.id}-${Date.now()}.${kind}`;

    const { error: uploadError } = await db.storage
      .from(BUCKET)
      .upload(path, bytes, {
        contentType: kind === "png" ? "image/png" : "image/jpeg",
        upsert: false,
      });

    if (uploadError) {
      console.error("Screenshot upload failed:", uploadError);
      return fail("Could not upload your screenshot. Please try again.", 500);
    }

    const fields = {
      certificate_name: certificateName,
      transaction_id: transactionId,
      amount: settings?.certificate_fee ?? null,
      screenshot_path: path,
      status: "pending",
      reject_reason: null,
      reviewed_by: null,
      reviewed_at: null,
    };

    const { error: saveError } = existing
      ? await db.from("internship_payments").update(fields).eq("id", existing.id)
      : await db
          .from("internship_payments")
          .insert({ enrollment_id: enrollment.id, ...fields });

    if (saveError) {
      await db.storage.from(BUCKET).remove([path]);

      if (saveError.code === "23505") {
        return fail("This transaction ID has already been used.", 409);
      }

      console.error("Payment save failed:", saveError);
      return fail("Could not save your payment. Please try again.", 500);
    }

    if (existing?.screenshot_path) {
      await db.storage.from(BUCKET).remove([existing.screenshot_path]);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Internship payment failed:", error);
    return fail("Could not process your payment. Please try again.", 500);
  }
}
