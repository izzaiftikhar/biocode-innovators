import nodemailer from "nodemailer";

/** Emails the certificate PDF. Never throws: returns false if email is unavailable. */
export async function sendCertificateEmail(opts: {
  to: string | undefined | null;
  name: string;
  courseTitle: string;
  certCode: string;
  verifyUrl: string;
  pdf: Uint8Array;
}): Promise<boolean> {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!opts.to || !user || !pass) return false;

  try {
    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com", port: 465, secure: true, auth: { user, pass },
    });

    await transporter.sendMail({
      from: `"BioCode Innovators" <${user}>`,
      to: opts.to,
      subject: `Your certificate: ${opts.courseTitle}`,
      text: [
        `Congratulations ${opts.name}!`,
        "",
        `Your certificate for "${opts.courseTitle}" is attached.`,
        `Certificate ID: ${opts.certCode}`,
        `Anyone can verify it here: ${opts.verifyUrl}`,
      ].join("\n"),
      attachments: [
        { filename: `${opts.certCode}.pdf`, content: Buffer.from(opts.pdf), contentType: "application/pdf" },
      ],
    });
    return true;
  } catch (error) {
    console.error("Certificate email failed:", error);
    return false;
  }
}
