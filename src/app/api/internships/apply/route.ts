import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { createServerSupabase } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth/server";
import { siteUrl } from "@/lib/certificates/generate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const user = await getSessionUser();

    if (!user) {
      return NextResponse.json(
        { error: "Please sign in to apply." },
        { status: 401 }
      );
    }

    const email = typeof user.email === "string" ? user.email.trim() : "";

    if (!email) {
      return NextResponse.json(
        { error: "Your account has no email address." },
        { status: 400 }
      );
    }

    const body = (await req.json().catch(() => null)) as {
      internshipId?: unknown;
      fullName?: unknown;
      confirmName?: unknown;
    } | null;

    if (
      !body ||
      typeof body.internshipId !== "string" ||
      !body.internshipId.trim()
    ) {
      return NextResponse.json(
        { error: "A valid internship is required." },
        { status: 400 }
      );
    }

    const fullName =
      typeof body.fullName === "string"
        ? body.fullName.replace(/\s+/g, " ").trim()
        : "";

    if (
      fullName.length < 2 ||
      fullName.length > 100 ||
      /[<>]/.test(fullName) ||
      [...fullName].some((character) => character.charCodeAt(0) < 32)
    ) {
      return NextResponse.json(
        { error: "Please enter your full name (2 to 100 characters)." },
        { status: 400 }
      );
    }

    if (body.confirmName !== true) {
      return NextResponse.json(
        {
          error:
            "Please confirm that your name is spelled exactly as it should appear on your certificate.",
        },
        { status: 400 }
      );
    }

    const db = createServerSupabase();

    const { data: internship, error: internshipError } = await db
      .from("internships")
      .select("id, title, department, duration, is_open, published")
      .eq("id", body.internshipId.trim())
      .maybeSingle();

    if (internshipError) {
      console.error("Internship lookup failed:", internshipError);
      return NextResponse.json(
        { error: "Could not verify the internship. Please try again." },
        { status: 500 }
      );
    }

    if (!internship?.published) {
      return NextResponse.json(
        { error: "Internship not found." },
        { status: 404 }
      );
    }

    if (!internship.is_open) {
      return NextResponse.json(
        { error: "Applications for this internship are closed." },
        { status: 403 }
      );
    }

    const { data: existing } = await db
      .from("internship_enrollments")
      .select("id")
      .eq("internship_id", internship.id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({
        ok: true,
        alreadyEnrolled: true,
        enrollmentId: existing.id,
      });
    }

    const { data: enrollment, error: insertError } = await db
      .from("internship_enrollments")
      .insert({
        internship_id: internship.id,
        user_id: user.id,
        full_name: fullName,
        email,
      })
      .select("id, reference_id")
      .single();

    if (insertError || !enrollment) {
      if (insertError?.code === "23505") {
        const { data: raced } = await db
          .from("internship_enrollments")
          .select("id")
          .eq("internship_id", internship.id)
          .eq("user_id", user.id)
          .maybeSingle();

        return NextResponse.json({
          ok: true,
          alreadyEnrolled: true,
          enrollmentId: raced?.id ?? null,
        });
      }

      console.error("Enrollment insert failed:", insertError);
      return NextResponse.json(
        { error: "Could not complete your application. Please try again." },
        { status: 500 }
      );
    }

    // The enrollment is saved. A failed email never undoes it.
    const emailSent = await sendEnrollmentEmail({
      to: email,
      name: fullName,
      title: internship.title,
      domain: internship.department || "",
      duration: internship.duration || "",
      reference: enrollment.reference_id,
      panelUrl: `${siteUrl()}/internships/${internship.id}`,
    });

    return NextResponse.json({
      ok: true,
      enrollmentId: enrollment.id,
      emailSent,
    });
  } catch (error) {
    console.error("Internship application failed:", error);

    return NextResponse.json(
      { error: "Could not process your application. Please try again." },
      { status: 500 }
    );
  }
}

async function sendEnrollmentEmail(args: {
  to: string;
  name: string;
  title: string;
  domain: string;
  duration: string;
  reference: string;
  panelUrl: string;
}): Promise<boolean> {
  const gmailUser = process.env.GMAIL_USER;
  const gmailPassword = process.env.GMAIL_APP_PASSWORD;

  if (!gmailUser || !gmailPassword) {
    console.error("Enrollment email: Gmail settings are missing.");
    return false;
  }

  try {
    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: { user: gmailUser, pass: gmailPassword },
    });

    const details = [
      args.domain ? `Domain: ${args.domain}` : "",
      args.duration ? `Duration: ${args.duration}` : "",
      `Reference ID: ${args.reference}`,
    ].filter(Boolean);

    await transporter.sendMail({
      from: `"BioCode Innovators" <${gmailUser}>`,
      to: args.to,
      subject: `You are enrolled: ${args.title}`,
      text: [
        `Dear ${args.name},`,
        "",
        `Congratulations! You are now enrolled in the "${args.title}" internship at BioCode Innovators.`,
        "",
        ...details,
        "",
        `Open your internship panel to read the instructions, download your tasks and submit your work: ${args.panelUrl}`,
        "",
        "We wish you a great internship.",
        "BioCode Innovators",
      ].join("\n"),
      html: `
        <p>Dear ${escapeHtml(args.name)},</p>
        <p>Congratulations! You are now enrolled in the
        <strong>${escapeHtml(args.title)}</strong> internship at BioCode Innovators.</p>
        <p>${details.map(escapeHtml).join("<br />")}</p>
        <p>Open your <a href="${escapeHtml(args.panelUrl)}">internship panel</a>
        to read the instructions, download your tasks and submit your work.</p>
        <p>We wish you a great internship.<br />BioCode Innovators</p>
      `,
    });

    return true;
  } catch (error) {
    console.error("Enrollment email failed:", error);
    return false;
  }
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };

    return entities[character];
  });
}
