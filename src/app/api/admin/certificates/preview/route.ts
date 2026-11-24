import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getSessionUser, isAdmin } from "@/lib/auth/server";
import {
  DEFAULT_LAYOUT,
  renderCertificatePdf,
  type Layout,
} from "@/lib/certificates/generate";

export const runtime = "nodejs";

const KEYS = [
  "name_x",
  "name_y",
  "name_size",
  "id_x",
  "id_y",
] as const;

/** Renders the saved template with sample text so the admin can check positions. Nothing is stored. */
export async function POST(req: Request) {
  try {
    const user = await getSessionUser();

    if (!user) {
      return NextResponse.json(
        { error: "Please sign in." },
        { status: 401 }
      );
    }

    if (!(await isAdmin(user.id))) {
      return NextResponse.json(
        { error: "Only an admin can do this." },
        { status: 403 }
      );
    }

    const body = (await req.json().catch(() => null)) as {
      courseId?: unknown;
      layout?: unknown;
    } | null;

    if (!body || typeof body.courseId !== "string" || !body.courseId) {
      return NextResponse.json(
        { error: "Invalid request." },
        { status: 400 }
      );
    }

    const layout: Layout = { ...DEFAULT_LAYOUT };
    const given = (body.layout ?? {}) as Record<string, unknown>;

    for (const key of KEYS) {
      const value = given[key];

      if (typeof value === "number" && Number.isFinite(value)) {
        layout[key] = value;
      }
    }

    const db = createServerSupabase();

    const { data: tpl } = await db
      .from("certificate_templates")
      .select("file_path")
      .eq("course_id", body.courseId)
      .maybeSingle();

    if (!tpl) {
      return NextResponse.json(
        { error: "Save a template for this course first." },
        { status: 404 }
      );
    }

    const { data: file, error } = await db.storage
      .from("certificate-templates")
      .download(tpl.file_path);

    if (error || !file) {
      return NextResponse.json(
        { error: "Could not load the template." },
        { status: 500 }
      );
    }

    const pdf = await renderCertificatePdf({
      templateBytes: await file.arrayBuffer(),
      layout,
      holderName: "Sample Student Name",
      certCode: "BIO-SAMPLE0000",
    });

    return new Response(Buffer.from(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'inline; filename="preview.pdf"',
      },
    });
  } catch (error) {
    console.error("Certificate preview failed:", error);

    return NextResponse.json(
      { error: "Could not create the preview." },
      { status: 500 }
    );
  }
}
