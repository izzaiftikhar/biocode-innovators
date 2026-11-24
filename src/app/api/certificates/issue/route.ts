import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth/server";
import { issueCertificate, siteUrl } from "@/lib/certificates/generate";
import { sendCertificateEmail } from "@/lib/email/certificate";
import { quizRequirement } from "@/lib/courses/quiz";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as {
      courseId?: unknown;
      confirmName?: unknown;
      confirmedName?: unknown;
    } | null;

    if (
      !body ||
      typeof body.courseId !== "string" ||
      !body.courseId.trim()
    ) {
      return NextResponse.json(
        { error: "A valid course ID is required." },
        { status: 400 },
      );
    }

    const user = await getSessionUser();

    if (!user) {
      return NextResponse.json(
        { error: "Please sign in before requesting a certificate." },
        { status: 401 },
      );
    }

    const db = createServerSupabase();
    const courseId = body.courseId.trim();

    // Always use the authenticated user's ID and profile name.
    const { data: profile, error: profileError } = await db
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      console.error("Certificate profile lookup failed:", profileError);

      return NextResponse.json(
        { error: "Could not verify your profile. Please try again." },
        { status: 500 },
      );
    }

    const profileName =
      typeof profile?.full_name === "string"
        ? profile.full_name.trim()
        : "";

    if (!profileName) {
      return NextResponse.json(
        { error: "Please add your full name before requesting a certificate." },
        { status: 400 },
      );
    }

    if (profileName.length > 100) {
      return NextResponse.json(
        { error: "That name is too long for a certificate." },
        { status: 400 },
      );
    }

    if (
      body.confirmName !== true ||
      typeof body.confirmedName !== "string" ||
      body.confirmedName.trim() !== profileName
    ) {
      return NextResponse.json(
        {
          error:
            "Please confirm that your name is spelled exactly as it should appear on the certificate.",
        },
        { status: 400 },
      );
    }

    // Verify the course is publicly available.
    const { data: course, error: courseError } = await db
      .from("courses")
      .select("id, published")
      .eq("id", courseId)
      .maybeSingle();

    if (courseError) {
      console.error("Certificate course lookup failed:", courseError);

      return NextResponse.json(
        { error: "Could not verify the course. Please try again." },
        { status: 500 },
      );
    }

    if (!course?.published) {
      return NextResponse.json(
        { error: "Course not found." },
        { status: 404 },
      );
    }

    // Confirm the authenticated user is enrolled.
    const { data: enrolment, error: enrolmentError } = await db
      .from("enrolments")
      .select("user_id")
      .eq("user_id", user.id)
      .eq("course_id", courseId)
      .maybeSingle();

    if (enrolmentError) {
      console.error("Certificate enrolment lookup failed:", enrolmentError);

      return NextResponse.json(
        { error: "Could not verify your enrolment. Please try again." },
        { status: 500 },
      );
    }

    if (!enrolment) {
      return NextResponse.json(
        { error: "You are not enrolled in this course." },
        { status: 403 },
      );
    }

    // Every course module must exist and be completed by this student.
    const { data: modules, error: modulesError } = await db
      .from("modules")
      .select("id")
      .eq("course_id", courseId);

    if (modulesError) {
      console.error("Certificate modules lookup failed:", modulesError);

      return NextResponse.json(
        { error: "Could not verify course completion. Please try again." },
        { status: 500 },
      );
    }

    if (!modules?.length) {
      return NextResponse.json(
        { error: "This course has no modules." },
        { status: 400 },
      );
    }

    const { data: progress, error: progressError } = await db
      .from("module_progress")
      .select("module_id, status")
      .eq("user_id", user.id)
      .in(
        "module_id",
        modules.map((module) => module.id),
      );

    if (progressError) {
      console.error("Certificate progress lookup failed:", progressError);

      return NextResponse.json(
        { error: "Could not verify course completion. Please try again." },
        { status: 500 },
      );
    }

    const completed = new Set(
      (progress ?? [])
        .filter((item) => item.status === "completed")
        .map((item) => item.module_id),
    );

    if (!modules.every((module) => completed.has(module.id))) {
      return NextResponse.json(
        {
          error:
            "Complete and get approval for every module before requesting your certificate.",
        },
        { status: 403 },
      );
    }

    // If this course has a published final quiz with questions, passing it
    // is required. Database errors are surfaced rather than treated as success.
    const quiz = await quizRequirement(db, user.id, courseId);

    if (quiz.required && !quiz.passed) {
      return NextResponse.json(
        {
          error: quiz.attempted
            ? "You did not reach the pass mark on the final quiz."
            : "Pass the final quiz before requesting your certificate.",
        },
        { status: 403 },
      );
    }

    // Return an existing valid certificate only after eligibility is verified.
    const { data: existing, error: existingError } = await db
      .from("certificates")
      .select("cert_code")
      .eq("user_id", user.id)
      .eq("course_id", courseId)
      .eq("status", "valid")
      .maybeSingle();

    if (existingError) {
      console.error("Existing certificate lookup failed:", existingError);

      return NextResponse.json(
        { error: "Could not check existing certificates. Please try again." },
        { status: 500 },
      );
    }

    if (existing) {
      return NextResponse.json({
        ok: true,
        certCode: existing.cert_code,
        verifyUrl: `${siteUrl()}/verify/${existing.cert_code}`,
        alreadyIssued: true,
      });
    }

    try {
      const issued = await issueCertificate({
        userId: user.id,
        courseId,
        holderName: profileName,
      });

      const emailSent = await sendCertificateEmail({
        to: user.email,
        name: profileName,
        courseTitle: issued.courseTitle,
        certCode: issued.certCode,
        verifyUrl: issued.verifyUrl,
        pdf: issued.pdf,
      });

      return NextResponse.json({
        ok: true,
        certCode: issued.certCode,
        verifyUrl: `${siteUrl()}/verify/${issued.certCode}`,
        emailSent,
      });
    } catch (error) {
      if (error instanceof Error && error.message === "ALREADY_ISSUED") {
        const { data: existingAfterRace, error: lookupError } = await db
          .from("certificates")
          .select("cert_code")
          .eq("user_id", user.id)
          .eq("course_id", courseId)
          .eq("status", "valid")
          .maybeSingle();

        if (lookupError) {
          console.error(
            "Certificate lookup after duplicate issuance:",
            lookupError,
          );

          return NextResponse.json(
            { error: "Could not verify the issued certificate." },
            { status: 500 },
          );
        }

        if (existingAfterRace) {
          return NextResponse.json({
            ok: true,
            certCode: existingAfterRace.cert_code,
            verifyUrl: `${siteUrl()}/verify/${existingAfterRace.cert_code}`,
            alreadyIssued: true,
          });
        }
      }

      console.error("Certificate issuance failed:", error);

      return NextResponse.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Could not issue the certificate.",
        },
        { status: 500 },
      );
    }
  } catch (error) {
    console.error("Certificate request failed:", error);

    return NextResponse.json(
      { error: "Could not process the certificate request. Please try again." },
      { status: 500 },
    );
  }
}
