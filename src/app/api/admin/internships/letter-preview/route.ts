import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getSessionUser, isAdmin } from "@/lib/auth/server";
import { renderOfferLetterPng } from "@/lib/internships/letter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BUCKET = "internship-files";

/** Renders a saved template with a test name. Nothing is stored. */
export async function POST(req: Request) {
  try {
    const user = await getSessionUser();

    if (!user) {
      return NextResponse.json({ error: "Please sign in." }, { status: 401 });
    }

    if (!(await isAdmin(user.id))) {
      return NextResponse.json(
        { error: "Only an admin can do this." },
        { status: 403 }
      );
    }

    const body = (await req.json().catch(() => null)) as {
      internshipId?: unknown;
      layout?: unknown;
      kind?: unknown;
      name?: unknown;
    } | null;

    if (!body || typeof body.internshipId !== "string" || !body.internshipId) {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }

    const kind = body.kind === "appreciation" ? "appreciation" : "certificate";

    const typed =
      typeof body.name === "string"
        ? body.name.replace(/\s+/g, " ").trim()
        : "";
    const name =
      typed.length >= 2 && typed.length <= 100 && !/[<>]/.test(typed)
        ? typed
        : "Sample Student Name";

    const db = createServerSupabase();

    const { data: internship } = await db
      .from("internships")
      .select("certificate_template_path, appreciation_template_path")
      .eq("id", body.internshipId)
      .maybeSingle();

    if (!internship) {
      return NextResponse.json(
        { error: "Internship not found." },
        { status: 404 }
      );
    }

    const templatePath =
      kind === "appreciation"
        ? internship.appreciation_template_path
        : internship.certificate_template_path;

    if (!templatePath) {
      return NextResponse.json(
        {
          error:
            kind === "appreciation"
              ? "Upload an appreciation letter template first."
              : "Upload a certificate template first.",
        },
        { status: 404 }
      );
    }

    const { data: file, error } = await db.storage
      .from(BUCKET)
      .download(templatePath);

    if (error || !file) {
      return NextResponse.json(
        { error: "Could not load the template." },
        { status: 500 }
      );
    }

    const png = await renderOfferLetterPng({
      templateBytes: await file.arrayBuffer(),
      layout: body.layout,
      values: { name },
    });

    return new Response(new Uint8Array(png), {
      headers: {
        "Content-Type": "image/png",
        "Content-Disposition": 'inline; filename="preview.png"',
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Template preview failed:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error && error.message.includes("template must be")
            ? error.message
            : "Could not create the preview.",
      },
      { status: 500 }
    );
  }
}
