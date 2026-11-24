import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { randomBytes } from "crypto";
import { createServerSupabase } from "@/lib/supabase/server";

export type Layout = {
  name_x: number;
  name_y: number;
  name_size: number;
  id_x: number;
  id_y: number;
};

/** Starting positions for an A4 landscape template (842 x 595 points). */
export const DEFAULT_LAYOUT: Layout = {
  name_x: 421,
  name_y: 300,
  name_size: 36,
  id_x: 60,
  id_y: 40,
};

export function siteUrl() {
  const url = (process.env.NEXT_PUBLIC_SITE_URL ?? "")
    .trim()
    .replace(/\/+$/, "");

  if (
    process.env.NODE_ENV === "production" &&
    (!url || /localhost|127\.0\.0\.1/.test(url))
  ) {
    throw new Error(
      "NEXT_PUBLIC_SITE_URL must be set to the live site address before issuing certificates."
    );
  }

  return url;
}

/** Draws the student's name and certificate ID onto the admin's blank template. */
export async function renderCertificatePdf(opts: {
  templateBytes: ArrayBuffer | Uint8Array;
  layout: Layout;
  holderName: string;
  certCode: string;
}): Promise<Uint8Array> {
  const l = opts.layout;
  const pdf = await PDFDocument.load(opts.templateBytes);

  pdf.registerFontkit(fontkit);

  const page = pdf.getPages()[0];

  if (!page) {
    throw new Error("The certificate template PDF has no pages.");
  }

  const fontPath = path.join(
    process.cwd(),
    "public",
    "fonts",
    "PinyonScript-Regular.ttf"
  );

  const scriptFontBytes = await readFile(fontPath);
  const scriptFont = await pdf.embedFont(scriptFontBytes, { subset: true });
  const regular = await pdf.embedFont(StandardFonts.Helvetica);

  let nameWidth: number;

  try {
    nameWidth = scriptFont.widthOfTextAtSize(opts.holderName, l.name_size);
  } catch {
    throw new Error(
      "The student's name contains characters that the certificate script font cannot print."
    );
  }

  page.drawText(opts.holderName, {
    x: l.name_x - nameWidth / 2,
    y: l.name_y,
    size: l.name_size,
    font: scriptFont,
    color: rgb(0.06, 0.16, 0.28),
  });

  page.drawText(`Certificate ID: ${opts.certCode}`, {
    x: l.id_x,
    y: l.id_y,
    size: 9,
    font: regular,
    color: rgb(0.35, 0.4, 0.47),
  });

  return pdf.save();
}

/** Builds the PDF from the course's template, stores it, and records the certificate. */
export async function issueCertificate(opts: {
  userId: string;
  courseId: string;
  holderName: string;
}) {
  const db = createServerSupabase();

  const { data: course } = await db
    .from("courses")
    .select("id, title")
    .eq("id", opts.courseId)
    .maybeSingle();

  const { data: tpl } = await db
    .from("certificate_templates")
    .select("file_path, layout")
    .eq("course_id", opts.courseId)
    .maybeSingle();

  if (!course) {
    throw new Error("Course not found.");
  }

  if (!tpl) {
    throw new Error("No certificate template has been set up for this course yet.");
  }

  const { data: file, error: dlErr } = await db.storage
    .from("certificate-templates")
    .download(tpl.file_path);

  if (dlErr || !file) {
    throw new Error("Could not load the certificate template.");
  }

  const certCode = `BIO-${randomBytes(5).toString("hex").toUpperCase()}`;
  const verifyUrl = `${siteUrl()}/verify/${certCode}`;

  const bytes = await renderCertificatePdf({
    templateBytes: await file.arrayBuffer(),
    layout: { ...DEFAULT_LAYOUT, ...(tpl.layout as Partial<Layout>) },
    holderName: opts.holderName,
    certCode,
  });

  const storagePath = `${opts.userId}/${certCode}.pdf`;

  const { error: upErr } = await db.storage
    .from("certificates")
    .upload(storagePath, bytes, { contentType: "application/pdf" });

  if (upErr) {
    throw new Error("Could not store the certificate file.");
  }

  const { error: insErr } = await db.from("certificates").insert({
    cert_code: certCode,
    user_id: opts.userId,
    course_id: course.id,
    holder_name: opts.holderName,
    course_title: course.title,
    pdf_path: storagePath,
    status: "valid",
  });

  if (insErr) {
    await db.storage.from("certificates").remove([storagePath]);

    if (insErr.code === "23505") {
      throw new Error("ALREADY_ISSUED");
    }

    throw new Error("Could not record the certificate.");
  }

  return {
    certCode,
    verifyUrl,
    path: storagePath,
    pdf: bytes,
    courseTitle: course.title,
  };
}
