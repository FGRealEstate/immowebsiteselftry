const nodemailer = require("nodemailer");

function clean(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function escapeHtml(value) {
  return clean(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

async function sendInternalNotification({ subject, replyTo, text, html, to }) {
  const smtpHost = clean(process.env.SMTP_HOST || "smtp.office365.com");
  const smtpPort = Number(process.env.SMTP_PORT || 587);
  const smtpUser = clean(process.env.SMTP_USER);
  const smtpPass = process.env.SMTP_PASS;
  const from = clean(process.env.MAIL_FROM || smtpUser);
  const recipient = clean(to || process.env.WEBSITE_LEAD_EMAIL || "info@fg-realestate.de");

  if (!smtpUser || !smtpPass) {
    return { sent: false, skipped: true, reason: "SMTP_USER oder SMTP_PASS fehlt" };
  }

  try {
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      requireTLS: smtpPort !== 465,
      auth: { user: smtpUser, pass: smtpPass },
      tls: { ciphers: "TLSv1.2" },
    });

    const result = await transporter.sendMail({
      from,
      to: recipient,
      replyTo: clean(replyTo) || undefined,
      subject: clean(subject) || "Neue Website-Anfrage",
      text: clean(text),
      html: html || `<pre style="font-family:Arial,sans-serif;white-space:pre-wrap">${escapeHtml(text)}</pre>`,
    });

    return { sent: true, to: recipient, messageId: result.messageId };
  } catch (error) {
    console.error("WEBSITE MAIL ERROR:", error);
    return { sent: false, skipped: false, error: error.message };
  }
}

module.exports = { sendInternalNotification, escapeHtml, clean };
