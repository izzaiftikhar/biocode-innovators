import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/internships/certificate?enrollment=<id>[&kind=appreciation] */
export async function GET(req: Request) {
  try {
    const user = await getSessionUser();

    if (!user) {
      return NextResponse.json({ error: "Please sign in." }, { status: 401 });
    }

    const params = new URL(req.url).searchParams;
    const enrollmentId = params.get("enrollment") ?? "";
    const appreciation = params.get("kind") === "appreciation";

    if (!enrollmentId) {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }

    const db = createServerSupabase();

    // Only the intern who owns this enrollment can download its documents.
    const { data: enrollment } = await db
      .from("internship_enrollments")
      .select("id")
      .eq("id", enrollmentId)
      .eq("user_id", user.id)
      .maybeSingle();

    const { data: cert } = enrollment
      ? await db
          .from("internship_certificates")
          .select("verification_code, file_path, appreciation_path")
          .eq("enrollment_id", enrollment.id)
          .maybeSingle()
      : { data: null };

    const path = appreciation ? cert?.appreciation_path : cert?.file_path;

    if (!cert || !path) {
      return NextResponse.json(
        { error: appreciation ? "Appreciation letter not found." : "Certificate not found." },
        { status: 404 }
      );
    }

    const filename = appreciation
      ? `Internship-Appreciation-Letter-${cert.verification_code}.png`
      : `Internship-Certificate-${cert.verification_code}.png`;

    const { data, error } = await db.storage
      .from("internship-files")
      .createSignedUrl(path, 60, { download: filename });

    if (error || !data?.signedUrl) {
      console.error("Document link failed:", error);
      return NextResponse.json(
        { error: "Could not create the download link." },
        { status: 500 }
      );
    }

    return NextResponse.redirect(data.signedUrl);
  } catch (error) {
    console.error("Internship document download failed:", error);
    return NextResponse.json(
      { error: "Could not open the document." },
      { status: 500 }
    );
  }
}
