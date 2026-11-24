import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { randomBytes } from "crypto";
import { createServerSupabase } from "@/lib/supabase/server";
import { getSessionUser, isAdmin } from "@/lib/auth/server";
import { notifyPaymentRejected } from "@/lib/internships/notify";
import { siteUrl } from "@/lib/certificates/generate";
import { renderOfferLetterPng } from "@/lib/internships/letter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BUCKET = "internship-files";

const fail = (error: string, status = 400) =>
  NextResponse.json({ error }, { status });

export async function POST(req: Request) {
  try {
    const user = await getSessionUser();
    if (!user) return fail("Please sign in.", 401);
    if (!(await isAdmin(user.id))) {
      return fail("Only an admin can review payments.", 403);
    }

    const body = (await req.json().catch(() => null)) as {
      paymentId?: unknown;
      decision?: unknown;
      reason?: unknown;
    } | null;

    if (
      !body ||
      typeof body.paymentId !== "string" ||
      (body.decision !== "approved" && body.decision !== "rejected")
    ) {
      return fail("Invalid request.");
    }

    const reason =
      typeof body.reason === "string" ? body.reason.trim().slice(0, 500) : "";

    const db = createServerSupabase();

    const { data: payment } = await db
      .from("internship_payments")
      .select("id, enrollment_id, certificate_name, status")
      .eq("id", body.paymentId)
      .maybeSingle();

    if (!payment) return fail("Payment not found.", 404);

    const reviewed = {
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
    };

    if (body.decision === "rejected") {
      if (!reason) return fail("Please give the student a reason.");
      if (payment.status === "approved") {
        return fail("This payment is already approved.", 409);
      }

      const { error } = await db
        .from("internship_payments")
        .update({ status: "rejected", reject_reason: reason, ...reviewed })
        .eq("id", payment.id);

      if (error) {
        console.error("Payment rejection failed:", error);
        return fail("Could not save the decision.", 500);
      }

      await notifyPaymentRejected(db, payment.enrollment_id, reason);

      return NextResponse.json({ ok: true });
    }

    // ---- Approval: only after every task is approved ----
    if (payment.status === "rejected") {
      return fail("Ask the student to resubmit their payment first.", 409);
    }

    const { data: allApproved } = await db.rpc("internship_all_tasks_approved", {
      p_enrollment: payment.enrollment_id,
    });

    if (allApproved !== true) {
      return fail(
        "Approve this student's final submission first, then verify the payment.",
        409
      );
    }

    const { data: enrollment } = await db
      .from("internship_enrollments")
      .select("id, user_id, email, internship_id")
      .eq("id", payment.enrollment_id)
      .maybeSingle();

    if (!enrollment) return fail("Enrollment not found.", 404);

    const { data: internship } = await db
      .from("internships")
      .select(
        "title, department, duration, certificate_template_path, certificate_layout, appreciation_template_path, appreciation_layout"
      )
      .eq("id", enrollment.internship_id)
      .maybeSingle();

    if (!internship) return fail("Internship not found.", 404);

    const { data: existingCert } = await db
      .from("internship_certificates")
      .select("verification_code")
      .eq("enrollment_id", enrollment.id)
      .maybeSingle();

    let code = existingCert?.verification_code ?? "";
    let emailSent = false;

    if (!existingCert) {
      if (!internship.certificate_template_path) {
        return fail(
          "Upload the internship certificate template first (Internships > Tasks & files)."
        );
      }

      const { data: templateFile, error: templateError } = await db.storage
        .from(BUCKET)
        .download(internship.certificate_template_path);

      if (templateError || !templateFile) {
        console.error("Certificate template download failed:", templateError);
        return fail("Could not load the certificate template.", 500);
      }

      code = `BCIC-${randomBytes(5).toString("hex").toUpperCase()}`;
      const domain = internship.department || internship.title;
      const duration = internship.duration || "";
      const path = `${enrollment.user_id}/certificates/${code}.png`;

      let png: Buffer;

      try {
        png = await renderOfferLetterPng({
          templateBytes: await templateFile.arrayBuffer(),
          layout: internship.certificate_layout,
          values: {
            name: payment.certificate_name,
            domain,
            duration,
            date: new Date().toLocaleDateString("en-GB", {
              day: "numeric",
              month: "long",
              year: "numeric",
            }),
            ref: code,
          },
        });
      } catch (error) {
        console.error("Certificate render failed:", error);
        return fail(
          "Could not create the certificate image. Check that the certificate template is a valid PNG.",
          500
        );
      }

      const { error: uploadError } = await db.storage
        .from(BUCKET)
        .upload(path, png, { contentType: "image/png", upsert: false });

      if (uploadError) {
        console.error("Certificate upload failed:", uploadError);
        return fail("Could not store the certificate.", 500);
      }

      const { error: insertError } = await db
        .from("internship_certificates")
        .insert({
          enrollment_id: enrollment.id,
          certificate_name: payment.certificate_name,
          verification_code: code,
          file_path: path,
        });

      if (insertError) {
        await db.storage.from(BUCKET).remove([path]);
        console.error("Certificate record failed:", insertError);
        return fail("Could not record the certificate.", 500);
      }

      emailSent = await sendCertificateEmail({
        to: enrollment.email,
        name: payment.certificate_name,
        title: internship.title,
        code,
        verifyUrl: `${siteUrl()}/verify/${code}`,
        dashboardUrl: `${siteUrl()}/dashboard`,
        png,
      });
    }

    // Appreciation letter: issued with the certificate. Also fills in if an
    // earlier approval attempt failed after the certificate was created.
    if (internship.appreciation_template_path && code) {
      const { data: certRow } = await db
        .from("internship_certificates")
        .select("appreciation_path")
        .eq("enrollment_id", enrollment.id)
        .maybeSingle();

      if (certRow && !certRow.appreciation_path) {
        const appPath = `${enrollment.user_id}/appreciation/${code}.png`;

        try {
          const { data: appFile, error: appFileError } = await db.storage
            .from(BUCKET)
            .download(internship.appreciation_template_path);

          if (appFileError || !appFile) throw appFileError ?? new Error("No template");

          const appPng = await renderOfferLetterPng({
            templateBytes: await appFile.arrayBuffer(),
            layout: internship.appreciation_layout,
            values: {
              name: payment.certificate_name,
              domain: internship.department || internship.title,
              duration: internship.duration || "",
              date: new Date().toLocaleDateString("en-GB", {
                day: "numeric",
                month: "long",
                year: "numeric",
              }),
              ref: code,
            },
          });

          const { error: appUploadError } = await db.storage
            .from(BUCKET)
            .upload(appPath, appPng, { contentType: "image/png", upsert: true });

          if (appUploadError) throw appUploadError;

          const { error: appSaveError } = await db
            .from("internship_certificates")
            .update({ appreciation_path: appPath })
            .eq("enrollment_id", enrollment.id);

          if (appSaveError) throw appSaveError;
        } catch (error) {
          await db.storage.from(BUCKET).remove([appPath]);
          console.error("Appreciation letter failed:", error);
          return fail(
            "The certificate was issued, but the appreciation letter could not be created. Check its template, then click approve again.",
            500
          );
        }
      }
    }

    await db
      .from("internship_payments")
      .update({ status: "approved", reject_reason: null, ...reviewed })
      .eq("id", payment.id);

    await db
      .from("internship_enrollments")
      .update({ status: "completed" })
      .eq("id", enrollment.id);

    return NextResponse.json({
      ok: true,
      code,
      emailSent,
      alreadyIssued: Boolean(existingCert),
    });
  } catch (error) {
    console.error("Internship payment review failed:", error);
    return fail("An unexpected error occurred.", 500);
  }
}

async function sendCertificateEmail(args: {
  to: string;
  name: string;
  title: string;
  code: string;
  verifyUrl: string;
  dashboardUrl: string;
  png: Buffer;
}): Promise<boolean> {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;

  if (!args.to || !user || !pass) {
    console.error("Certificate email: Gmail settings are missing.");
    return false;
  }

  try {
    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: { user, pass },
    });

    await transporter.sendMail({
      from: `"BioCode Innovators" <${user}>`,
      to: args.to,
      subject: `Your internship certificate: ${args.title}`,
      text: [
        `Congratulations ${args.name}!`,
        "",
        `Your internship certificate for "${args.title}" is attached.`,
        `Certificate ID: ${args.code}`,
        `Anyone can verify it here: ${args.verifyUrl}`,
        `You can also download it from your dashboard: ${args.dashboardUrl}`,
        "",
        "BioCode Innovators",
      ].join("\n"),
      attachments: [
        {
          filename: `Internship-Certificate-${args.code}.png`,
          content: args.png,
          contentType: "image/png",
        },
      ],
    });

    return true;
  } catch (error) {
    console.error("Internship certificate email failed:", error);
    return false;
  }
}
