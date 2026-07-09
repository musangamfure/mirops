import nodemailer from "nodemailer";

// ─── GMAIL SMTP MAILER ───────────────────────────────────────────────────────
// Sends mail through a Gmail account using an App Password (not the regular
// account password — see README for how to generate one). Requires:
//   GMAIL_USER          the Gmail address that sends the mail
//   GMAIL_APP_PASSWORD   the 16-character App Password for that account
let transporter: ReturnType<typeof nodemailer.createTransport> | null = null;

function getTransporter() {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) {
    throw new Error(
      "GMAIL_USER and GMAIL_APP_PASSWORD must be set to send email."
    );
  }
  if (!transporter) {
    transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user, pass },
    });
  }
  return transporter;
}

export async function sendEmail({
  to, subject, html, text,
}: {
  to: string | string[];
  subject: string;
  html: string;
  text: string;
}) {
  const user = process.env.GMAIL_USER;
  const t = getTransporter();
  await t.sendMail({
    from: `"Miru Mushrooms Ops" <${user}>`,
    to: Array.isArray(to) ? to.join(", ") : to,
    subject,
    text,
    html,
  });
}
