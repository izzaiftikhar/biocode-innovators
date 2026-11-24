
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import nodemailer from "nodemailer";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const authorization = req.headers.get("authorization");

    if (!authorization?.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Authentication required." },
        { status: 401 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json(
        { error: "Supabase is not configured." },
        { status: 503 }
      );
    }

    const token = authorization.slice("Bearer ".length);

    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    });

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json(
        { error: "Your session is invalid. Please sign in again." },
        { status: 401 }
      );
    }

    const body = await req.json();

    const assignmentId =
      typeof body.assignmentId === "string" ? body.assignmentId : "";
    const filePath =
      typeof body.filePath === "string" ? body.filePath : "";
    const fileName =
      typeof body.fileName === "string" ? body.fileName.trim() : "";

    if (!assignmentId || !filePath || !fileName) {
      return NextResponse.json(
        { error: "Submission details are missing." },
        { status: 400 }
      );
    }

    // Confirm that this exact file belongs to the signed-in student.
    const { data: submission, error: submissionError } = await supabase
      .from("submissions")
      .select("id, assignment_id, file_path")
      .eq("user_id", user.id)
      .eq("assignment_id", assignmentId)
      .eq("file_path", filePath)
      .maybeSingle();

    if (submissionError) {
      console.error("Submission verification error:", submissionError);

      return NextResponse.json(
        { error: "Could not verify the saved submission." },
        { status: 500 }
      );
    }

    if (!submission) {
      return NextResponse.json(
        { error: "The saved submission could not be verified." },
        { status: 403 }
      );
    }

    // Generate a temporary link to the private Storage object.
    const expiresIn = 24 * 60 * 60;

    const { data: signedFile, error: storageError } = await supabase.storage
      .from("course-assignments")
      .createSignedUrl(submission.file_path!, expiresIn);

    if (storageError || !signedFile?.signedUrl) {
      console.error("Submission download link error:", storageError);

      return NextResponse.json(
        {
          error:
            "Could not create the download link. Check the Storage read policies.",
        },
        { status: 500 }
      );
    }

    const gmailUser = process.env.GMAIL_USER;
    const gmailPassword = process.env.GMAIL_APP_PASSWORD;
    const recipient = process.env.CONTACT_TO_EMAIL;

    if (!gmailUser || !gmailPassword || !recipient) {
      console.error("Assignment notification: Gmail settings are missing.");

      return NextResponse.json(
        { error: "Email service is not configured." },
        { status: 503 }
      );
    }

    // Load the assignment title from the database rather than trusting the browser.
    const { data: assignment, error: assignmentError } = await supabase
      .from("assignments")
      .select("id, config")
      .eq("id", assignmentId)
      .maybeSingle();

    if (assignmentError || !assignment) {
      console.error("Assignment lookup error:", assignmentError);

      return NextResponse.json(
        { error: "Could not verify the assignment details." },
        { status: 500 }
      );
    }

    const config = assignment.config as { title?: string } | null;
    const assignmentTitle = config?.title || "Module Assignment";

    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: {
        user: gmailUser,
        pass: gmailPassword,
      },
    });

    const downloadUrl = signedFile.signedUrl;

    await transporter.sendMail({
      from: `"BioCode Innovators" <${gmailUser}>`,
      to: recipient,
      replyTo: user.email,
      subject: `New assignment submission: ${assignmentTitle}`,
      text: [
        "A student has submitted an assignment.",
        "",
        `Student email: ${user.email ?? "Not available"}`,
        `Student ID: ${user.id}`,
        `Assignment: ${assignmentTitle}`,
        `File name: ${fileName}`,
        `Submission time: ${new Date().toLocaleString()}`,
        "",
        "DOWNLOAD STUDENT SUBMISSION:",
        downloadUrl,
        "",
        "This private download link expires in 24 hours.",
      ].join("\n"),
      html: `
        <h2>New assignment submission</h2>
        <p><strong>Student email:</strong> ${escapeHtml(user.email ?? "Not available")}</p>
        <p><strong>Assignment:</strong> ${escapeHtml(assignmentTitle)}</p>
        <p><strong>File:</strong> ${escapeHtml(fileName)}</p>
        <p><strong>Submitted:</strong> ${escapeHtml(new Date().toLocaleString())}</p>
        <p>
          <a href="${escapeHtml(downloadUrl)}"
             style="display:inline-block;padding:12px 18px;background:#a5f3fc;color:#0f172a;text-decoration:none;border-radius:6px;font-weight:bold;">
            Download student submission
          </a>
        </p>
        <p>This private download link expires in 24 hours.</p>
      `,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Assignment notification email error:", error);

    return NextResponse.json(
      { error: "The assignment notification email could not be sent." },
      { status: 500 }
    );
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
