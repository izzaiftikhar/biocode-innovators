
import { NextResponse } from "next/server";
import nodemailer from "nodemailer";

export async function POST(req: Request) {
  try {
    const { name, email, topic, message } = await req.json();

    if (
      typeof name !== "string" ||
      typeof email !== "string" ||
      typeof message !== "string" ||
      !name.trim() ||
      !message.trim() ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
    ) {
      return NextResponse.json(
        { error: "Please provide valid contact details." },
        { status: 400 }
      );
    }

    const gmailUser = process.env.GMAIL_USER;
    const gmailPassword = process.env.GMAIL_APP_PASSWORD;
    const recipient = process.env.CONTACT_TO_EMAIL;

    if (!gmailUser || !gmailPassword || !recipient) {
      console.error("Contact form: Gmail environment variables are missing.");

      return NextResponse.json(
        { error: "Email service is not configured." },
        { status: 503 }
      );
    }

    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: {
        user: gmailUser,
        pass: gmailPassword,
      },
    });

    await transporter.sendMail({
      from: `"BioCode Innovators" <${gmailUser}>`,
      to: recipient,
      replyTo: email.trim(),
      subject: `${topic?.trim() || "Website message"}: from ${name.trim()}`,
      text: [
        `Name: ${name.trim()}`,
        `Email: ${email.trim()}`,
        `Topic: ${typeof topic === "string" ? topic.trim() : "Website message"}`,
        "",
        "Message:",
        message.trim(),
      ].join("\n"),
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Contact form email error:", error);

    return NextResponse.json(
      { error: "The message could not be sent. Please try again." },
      { status: 500 }
    );
  }
}
