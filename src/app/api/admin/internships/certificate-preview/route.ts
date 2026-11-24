import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getSessionUser, isAdmin } from "@/lib/auth/server";
import { renderOfferLetterPng } from "@/lib/internships/letter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BUCKET = "internship-files";

const fail = (error: string, status = 400) =>
  NextResponse.json({ error }, { status });

/** Shows how a student's confirmed name will look. Nothing is stored or sent. */
export async function POST(req: Request) {
  try {
    const user = await getSessionUser();
    if (!user) return fail("Please sign in.", 401);
    if (!(await isAdmin(user.id))) return fail("Only an admin can do this.", 403);

    const body = (await req.json().catch(() => null)) as {
      paymentId?: unknown;
      kind?: unknown;
    } | null;

    if (!body || typeof body.paymentId !== "string" || !body.paymentId) {
      return fail("Invalid request.");
    }

    const kind = body.kind === "appreciation" ? "appreciation" : "certificate";

    const db = createServerSupabase();

    const { data: payment } = await db
      .from("internship_payments")
      .select("certificate_name, enrollment_id")
      .eq("id", body.paymentId)
      .maybeSingle();

    if (!payment) return fail("Payment not found.", 404);

    const { data: enrollment } = await db
      .from("internship_enrollments")
      .select("internship_id")
      .eq("id", payment.enrollment_id)
      .maybeSingle();

    if (!enrollment) return fail("Enrollment not found.", 404);

    const { data: internship } = await db
      .from("internships")
      .select(
        "certificate_template_path, certificate_layout, appreciation_template_path, appreciation_layout"
      )
      .eq("id", enrollment.internship_id)
      .maybeSingle();

    if (!internship) return fail("Internship not found.", 404);

    const templatePath =
      kind === "appreciation"
        ? internship.appreciation_template_path
        : internship.certificate_template_path;
    const layout =
      kind === "appreciation"
        ? internship.appreciation_layout
        : internship.certificate_layout;

    if (!templatePath) {
      return fail(
        kind === "appreciation"
          ? "Upload an appreciation letter template first."
          : "Upload a certificate template first.",
        404
      );
    }

    const { data: file, error } = await db.storage
      .from(BUCKET)
      .download(templatePath);

    if (error || !file) return fail("Could not load the template.", 500);

    const png = await renderOfferLetterPng({
      templateBytes: await file.arrayBuffer(),
      layout,
      values: { name: payment.certificate_name },
    });

    return new Response(new Uint8Array(png), {
      headers: {
        "Content-Type": "image/png",
        "Content-Disposition": 'inline; filename="preview.png"',
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Certificate preview failed:", error);
    return fail("Could not create the preview.", 500);
  }
}
