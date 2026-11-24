import nodemailer from "nodemailer";
import { createServerSupabase } from "@/lib/supabase/server";
import { siteUrl } from "@/lib/certificates/generate";

type Db = ReturnType<typeof createServerSupabase>;

function dashboardUrl() {
  try {
    return `${siteUrl()}/dashboard`;
  } catch {
    return "your BioCode dashboard";
  }
}

async function send(to: string, subject: string, lines: string[]) {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;

  if (!to || !user || !pass) return false;

  try {
    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: { user, pass },
    });

    await transporter.sendMail({
      from: `"BioCode Innovators" <${user}>`,
      to,
      subject,
      text: [...lines, "", `Dashboard: ${dashboardUrl()}`, "", "BioCode Innovators"].join("\n"),
    });

    return true;
  } catch (error) {
    console.error("Internship notification email failed:", error);
    return false;
  }
}

/** Emails the intern after an admin approves a task or asks for a revision. Never throws. */
export async function notifyTaskReviewed(db: Db, submissionId: string) {
  try {
    const { data: sub } = await db
      .from("internship_submissions")
      .select("enrollment_id, task_id, status, feedback, score")
      .eq("id", submissionId)
      .maybeSingle();

    if (!sub) return;

    const [{ data: enrollment }, { data: task }] = await Promise.all([
      db
        .from("internship_enrollments")
        .select("email, full_name")
        .eq("id", sub.enrollment_id)
        .maybeSingle(),
      db
        .from("internship_tasks")
        .select("position, title")
        .eq("id", sub.task_id)
        .maybeSingle(),
    ]);

    if (!enrollment || !task) return;

    const label = `Task ${task.position}: ${task.title}`;
    const lines: string[] = [`Dear ${enrollment.full_name},`, ""];

    if (sub.status === "approved") {
      lines.push(`Your submission for "${label}" has been approved.`);
      if (sub.score !== null) lines.push(`Score: ${sub.score}/100`);
      if (sub.feedback) lines.push("", `Feedback: ${sub.feedback}`);

      const { data: allApproved } = await db.rpc("internship_all_tasks_approved", {
        p_enrollment: sub.enrollment_id,
      });

      if (allApproved === true) {
        lines.push(
          "",
          "All your tasks are now approved. You can complete the payment for your certificate from your dashboard."
        );
      }

      await send(enrollment.email, `Task approved: ${label}`, lines);
    } else if (sub.status === "needs_revision") {
      lines.push(`Your submission for "${label}" needs some changes.`);
      if (sub.feedback) lines.push("", `Feedback: ${sub.feedback}`);
      lines.push("", "Please update your work and resubmit it from your dashboard.");

      await send(enrollment.email, `Revision requested: ${label}`, lines);
    }
  } catch (error) {
    console.error("Task review notification failed:", error);
  }
}

/** Emails the intern after an admin reviews their combined submission. Never throws. */
export async function notifyFinalReviewed(db: Db, submissionId: string) {
  try {
    const { data: sub } = await db
      .from("internship_final_submissions")
      .select("enrollment_id, status, feedback, score")
      .eq("id", submissionId)
      .maybeSingle();

    if (!sub) return;

    const { data: enrollment } = await db
      .from("internship_enrollments")
      .select("email, full_name")
      .eq("id", sub.enrollment_id)
      .maybeSingle();

    if (!enrollment) return;

    const lines: string[] = [`Dear ${enrollment.full_name},`, ""];

    if (sub.status === "approved") {
      lines.push("Your internship submission has been approved.");
      if (sub.score !== null) lines.push(`Score: ${sub.score}/100`);
      if (sub.feedback) lines.push("", `Feedback: ${sub.feedback}`);
      lines.push(
        "",
        "You can now complete the payment from your dashboard to receive your certificate."
      );
      await send(enrollment.email, "Your internship submission is approved", lines);
    } else if (sub.status === "needs_revision") {
      lines.push("Your internship submission needs some changes.");
      if (sub.feedback) lines.push("", `Feedback: ${sub.feedback}`);
      lines.push(
        "",
        "Please update your work and resubmit it from your dashboard before the internship end date."
      );
      await send(enrollment.email, "Revision requested on your internship submission", lines);
    }
  } catch (error) {
    console.error("Final review notification failed:", error);
  }
}

/** Emails the intern when a payment is rejected. Never throws. */
export async function notifyPaymentRejected(
  db: Db,
  enrollmentId: string,
  reason: string
) {
  try {
    const { data: enrollment } = await db
      .from("internship_enrollments")
      .select("email, full_name")
      .eq("id", enrollmentId)
      .maybeSingle();

    if (!enrollment) return;

    await send(enrollment.email, "Your certificate payment needs attention", [
      `Dear ${enrollment.full_name},`,
      "",
      "We could not verify your certificate payment.",
      `Reason: ${reason}`,
      "",
      "Please submit the payment details again from your dashboard.",
    ]);
  } catch (error) {
    console.error("Payment rejection notification failed:", error);
  }
}
