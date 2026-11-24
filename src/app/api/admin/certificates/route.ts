import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getSessionUser, isAdmin } from "@/lib/auth/server";
import { issueCertificate } from "@/lib/certificates/generate";
import { sendCertificateEmail } from "@/lib/email/certificate";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
    if (!(await isAdmin(user.id))) {
      return NextResponse.json({ error: "Only an admin can do this." }, { status: 403 });
    }

    const body = (await req.json().catch(() => null)) as {
      action?: unknown; certificateId?: unknown; holderName?: unknown;
    } | null;

    if (
      !body ||
      (body.action !== "revoke" && body.action !== "reissue") ||
      typeof body.certificateId !== "string" || !body.certificateId
    ) {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }

    const db = createServerSupabase();

    const { data: cert } = await db
      .from("certificates")
      .select("id, user_id, course_id, holder_name, status")
      .eq("id", body.certificateId)
      .maybeSingle();

    if (!cert) return NextResponse.json({ error: "Certificate not found." }, { status: 404 });

    if (body.action === "revoke") {
      const { error } = await db.from("certificates").update({ status: "revoked" }).eq("id", cert.id);
      if (error) return NextResponse.json({ error: "Could not revoke the certificate." }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    // ---- Reissue: revoke the old one, issue a new one (optionally with a corrected name) ----
    const newName =
      typeof body.holderName === "string" && body.holderName.trim()
        ? body.holderName.trim()
        : cert.holder_name;

    if (newName.length > 100 || !cert.course_id) {
      return NextResponse.json({ error: "Invalid name or course." }, { status: 400 });
    }

    const previousStatus = cert.status;
    if (previousStatus === "valid") {
      const { error } = await db.from("certificates").update({ status: "revoked" }).eq("id", cert.id);
      if (error) return NextResponse.json({ error: "Could not revoke the old certificate." }, { status: 500 });
    }

    try {
      const issued = await issueCertificate({
        userId: cert.user_id, courseId: cert.course_id, holderName: newName,
      });

      const { data: authUser } = await db.auth.admin.getUserById(cert.user_id);
      const emailSent = await sendCertificateEmail({
        to: authUser.user?.email, name: newName, courseTitle: issued.courseTitle,
        certCode: issued.certCode, verifyUrl: issued.verifyUrl, pdf: issued.pdf,
      });

      return NextResponse.json({ ok: true, certCode: issued.certCode, emailSent });
    } catch (error) {
      // Put the old certificate back so the student is never left without one.
      if (previousStatus === "valid") {
        await db.from("certificates").update({ status: "valid" }).eq("id", cert.id);
      }
      console.error("Certificate reissue failed:", error);
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Could not reissue the certificate." },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Admin certificate action failed:", error);
    return NextResponse.json({ error: "An unexpected error occurred." }, { status: 500 });
  }
}
