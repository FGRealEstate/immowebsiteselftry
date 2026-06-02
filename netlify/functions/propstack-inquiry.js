const nodemailer = require("nodemailer");

exports.handler = async (event) => {
  console.log("PROPSTACK INQUIRY START");

  console.log("METHOD:", event.httpMethod);

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: JSON.stringify({
        success: false,
        error: "Method not allowed",
      }),
    };
  }

  try {
    const data = JSON.parse(event.body);

    console.log("PAYLOAD:", data);

    const {
      object_id,
      object_title,
      first_name,
      last_name,
      email,
      phone,
      contact_preference,
      message,
      privacy,
    } = data;

    // =========================
    // PROPSTACK API
    // =========================

    const propstackPayload = {
      first_name,
      last_name,
      email,
      phone,
      message:
        message ||
        `Neue Anfrage über Website für Objekt: ${object_title}`,
      source: "Website",
    };

    console.log("PROPSTACK PAYLOAD:", propstackPayload);

    const propstackResponse = await fetch(
      `${process.env.PROPSTACK_API_BASE}/v1/portal/inquiries`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.PROPSTACK_API_KEY}`,
        },
        body: JSON.stringify(propstackPayload),
      }
    );

    const propstackResult = await propstackResponse.text();

    console.log("PROPSTACK STATUS:", propstackResponse.status);
    console.log("PROPSTACK RESPONSE:", propstackResult);

    // =========================
    // SMTP MAIL
    // =========================

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT),
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    console.log("SMTP TRANSPORT READY");

    const mailResult = await transporter.sendMail({
      from: process.env.MAIL_FROM,
      to:
        process.env.PROPSTACK_PORTAL_INQUIRY_EMAIL ||
        process.env.MAIL_FROM,
      subject: `Neue Immobilienanfrage: ${object_title}`,
      html: `
        <h2>Neue Anfrage über Website</h2>

        <p><strong>Objekt:</strong> ${object_title}</p>
        <p><strong>Objekt-ID:</strong> ${object_id}</p>

        <hr>

        <p><strong>Name:</strong> ${first_name} ${last_name}</p>
        <p><strong>E-Mail:</strong> ${email}</p>
        <p><strong>Telefon:</strong> ${phone || "-"}</p>
        <p><strong>Kontaktart:</strong> ${
          contact_preference || "-"
        }</p>

        <hr>

        <p><strong>Nachricht:</strong></p>
        <p>${message || "-"}</p>

        <hr>

        <p><strong>Datenschutz akzeptiert:</strong> ${privacy}</p>
      `,
    });

    console.log("MAIL SENT:", mailResult.messageId);

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
      }),
    };
  } catch (error) {
    console.error("FUNCTION ERROR:", error);

    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: error.message,
      }),
    };
  }
};
