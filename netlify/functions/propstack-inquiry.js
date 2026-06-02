const nodemailer = require("nodemailer");

exports.handler = async (event) => {
  console.log("PROPSTACK INQUIRY START");
  console.log("METHOD:", event.httpMethod);

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: JSON.stringify({ success: false, error: "Method not allowed" }),
    };
  }

  try {
    const data = JSON.parse(event.body || "{}");
    console.log("PAYLOAD:", JSON.stringify(data, null, 2));

    const objectId = data.object_id || "";
    const objectTitle = data.object_title || "Objektanfrage";
    const firstName = data.first_name || "";
    const lastName = data.last_name || "";
    const fullName = `${firstName} ${lastName}`.trim();
    const email = data.email || "";
    const phone = data.phone || "";
    const contactPreference = data.contact_preference || "";
    const message = data.message || "";
    const privacy = data.privacy || "";
    const sourceUrl = data.source_url || "";

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || "smtp.office365.com",
      port: Number(process.env.SMTP_PORT || 587),
      secure: false,
      requireTLS: true,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
      tls: {
        ciphers: "TLSv1.2",
      },
    });

    console.log("SMTP TRANSPORT READY");

    const html = `
      <h2>Neue Objektanfrage über die Website</h2>

      <p><strong>Objekt:</strong> ${objectTitle}</p>
      <p><strong>Objekt-ID / Unit-ID:</strong> ${objectId}</p>

      <hr>

      <p><strong>Name:</strong> ${fullName}</p>
      <p><strong>E-Mail:</strong> ${email}</p>
      <p><strong>Telefon:</strong> ${phone || "-"}</p>
      <p><strong>Kontaktwunsch:</strong> ${contactPreference || "-"}</p>

      <hr>

      <p><strong>Nachricht:</strong></p>
      <p>${message || "-"}</p>

      <hr>

      <p><strong>Einwilligung:</strong> ${privacy || "-"}</p>
      <p><strong>Quelle:</strong><br>${sourceUrl || "-"}</p>
      <p><strong>Zeitpunkt:</strong> ${new Date().toISOString()}</p>
    `;

    const mailResult = await transporter.sendMail({
      from: process.env.MAIL_FROM || process.env.SMTP_USER,
      to: process.env.PROPSTACK_PORTAL_INQUIRY_EMAIL || "info@fg-realestate.de",
      replyTo: email || undefined,
      subject: `Neue Objektanfrage: ${objectTitle}`,
      html,
      text: `
Neue Objektanfrage über die Website

Objekt: ${objectTitle}
Objekt-ID / Unit-ID: ${objectId}

Name: ${fullName}
E-Mail: ${email}
Telefon: ${phone || "-"}
Kontaktwunsch: ${contactPreference || "-"}

Nachricht:
${message || "-"}

Einwilligung: ${privacy || "-"}
Quelle: ${sourceUrl || "-"}
Zeitpunkt: ${new Date().toISOString()}
      `,
    });

    console.log("MAIL SENT:", mailResult.messageId);

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        message: "Anfrage erfolgreich gesendet",
      }),
    };
  } catch (error) {
    console.error("FUNCTION ERROR:", error);

    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: error.message,
        code: error.code || null,
        response: error.response || null,
      }),
    };
  }
};
