import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BUCKET = "internship-files";

/** GET /api/internships/apply/file?enrollment=<id>&kind=letter|tasks */
export async function GET(req: Request) {
  try {
    const user = await getSessionUser();

    if (!user) {
      return NextResponse.json(
        { error: "Please sign in." },
        { status: 401 }
      );
    }

    const url = new URL(req.url);
    const enrollmentId = url.searchParams.get("enrollment") ?? "";
    const kind = url.searchParams.get("kind");

    if (!enrollmentId || (kind !== "letter" && kind !== "tasks")) {
      return NextResponse.json(
        { error: "Invalid request." },
        { status: 400 }
      );
    }

    const db = createServerSupabase();

    // Only the intern who owns this enrollment can download its files.
    const { data: enrollment } = await db
      .from("internship_enrollments")
      .select("id, internship_id, reference_id, letter_path")
      .eq("id", enrollmentId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!enrollment) {
      return NextResponse.json(
        { error: "Enrollment not found." },
        { status: 404 }
      );
    }

    let path: string | null = null;
    let filename = "";

    if (kind === "letter") {
      path = enrollment.letter_path;
      filename = `Internship-Offer-Letter-${enrollment.reference_id}.png`;
    } else {
      const { data: internship } = await db
        .from("internships")
        .select("tasks_pdf_path")
        .eq("id", enrollment.internship_id)
        .maybeSingle();

      path = internship?.tasks_pdf_path ?? null;
      filename = `Internship-Tasks-${enrollment.reference_id}.pdf`;
    }

    if (!path) {
      return NextResponse.json(
        { error: "That file is not available yet." },
        { status: 404 }
      );
    }

    const { data, error } = await db.storage
      .from(BUCKET)
      .createSignedUrl(path, 300, { download: filename });

    if (error || !data?.signedUrl) {
      console.error("Internship file link failed:", error);
      return NextResponse.json(
        { error: "Could not create the download link." },
        { status: 500 }
      );
    }

    return NextResponse.redirect(data.signedUrl);
  } catch (error) {
    console.error("Internship file request failed:", error);

    return NextResponse.json(
      { error: "Could not open the file." },
      { status: 500 }
    );
  }
}
