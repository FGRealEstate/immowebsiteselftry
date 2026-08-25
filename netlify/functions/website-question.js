const { sendInternalNotification, escapeHtml, clean } = require("./_shared/mailer");

exports.handler = async function (event) {
  if (event.httpMethod !== "POST") {
    return json(405, { success: false, error: "Method not allowed" });
  }

  try {
    const data = JSON.parse(event.body || "{}");

    // Honeypot: echte Besucher lassen dieses Feld leer.
    if (clean(data.company_website)) {
      return json(200, { success: true, message: "Vielen Dank." });
    }

    const name = clean(data.name);
    const email = clean(data.email);
    const phone = clean(data.phone);
    const question = clean(data.question);
    const sourceUrl = clean(data.source_url);
    const consent = data.privacy_consent === true || data.privacy_consent === "true";

    if (!name || !email || !question || !consent) {
      return json(400, { success: false, error: "Name, E-Mail, Frage und Datenschutz-Einwilligung sind erforderlich." });
    }
    if (name.length > 160 || email.length > 254 || phone.length > 80 || question.length > 5000) {
      return json(400, { success: false, error: "Eingabe ist zu lang." });
    }

    const text = [
      "Neue Frage über fg-realestate.de",
      "",
      `Name: ${name}`,
      `E-Mail: ${email}`,
      `Telefon: ${phone || "-"}`,
      `Quelle: ${sourceUrl || "-"}`,
      `Zeitpunkt: ${new Date().toISOString()}`,
      "",
      "Frage:",
      question,
    ].join("\n");

    const html = `
      <div style="font-family:Arial,sans-serif;color:#08082F;line-height:1.55">
        <h2 style="margin:0 0 16px">Neue Website-Frage</h2>
        <p><strong>Name:</strong> ${escapeHtml(name)}<br>
        <strong>E-Mail:</strong> ${escapeHtml(email)}<br>
        <strong>Telefon:</strong> ${escapeHtml(phone || "-")}<br>
        <strong>Quelle:</strong> ${escapeHtml(sourceUrl || "-")}</p>
        <div style="margin-top:20px;padding:18px;border-left:4px solid #D1B464;background:#f7f5ef">
          ${escapeHtml(question).replace(/\n/g, "<br>")}
        </div>
      </div>`;

    const mail = await sendInternalNotification({
      subject: `Neue Website-Frage von ${name}`,
      replyTo: email,
      text,
      html,
      to: process.env.WEBSITE_QUESTION_EMAIL || "info@fg-realestate.de",
    });

    if (!mail.sent) {
      return json(500, { success: false, error: "Die Frage konnte derzeit nicht per E-Mail versendet werden.", mail });
    }

    return json(200, { success: true, message: "Vielen Dank. Ihre Frage wurde direkt an uns gesendet." });
  } catch (error) {
    console.error("WEBSITE QUESTION ERROR:", error);
    return json(500, { success: false, error: "Die Frage konnte nicht versendet werden." });
  }
};

function json(statusCode, body) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
    body: JSON.stringify(body),
  };
}
