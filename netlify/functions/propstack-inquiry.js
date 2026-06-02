exports.handler = async function (event) {
  console.log("PROPSTACK INQUIRY START");
  console.log("METHOD:", event.httpMethod);

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: JSON.stringify({ success: false, error: "Method not allowed" })
    };
  }

  try {
    const payload = JSON.parse(event.body || "{}");

    console.log("PAYLOAD:", JSON.stringify(payload, null, 2));

    const resendKey = process.env.RESEND_API_KEY;
    const from =
      process.env.PROPSTACK_EMAIL_FROM ||
      process.env.MAIL_FROM ||
      "info@fg-realestate.de";

    const to =
      process.env.PROPSTACK_PORTAL_INQUIRY_EMAIL ||
      "info@fg-realestate.de";

    console.log("ENV DEBUG:", {
      hasPropstackBase: !!process.env.PROPSTACK_API_BASE,
      hasPropstackKey: !!process.env.PROPSTACK_API_KEY,
      hasResendKey: !!resendKey,
      from,
      to
    });

    const firstName = payload.first_name || payload.firstName || payload.vorname || "";
    const lastName = payload.last_name || payload.lastName || payload.nachname || "";
    const fullName = payload.full_name || payload.fullName || `${firstName} ${lastName}`.trim() || payload.name || "";
    const email = payload.email || "";
    const phone = payload.phone || payload.telefon || "";
    const message = payload.message || payload.nachricht || "";
    const objectId = payload.object_id || payload.objectId || payload.propertyId || "";
    const objectTitle = payload.object_title || payload.objectTitle || payload.propertyTitle || "Objektanfrage";
    const contactWish = payload.contact_preference || payload.contactWish || payload.kontaktwunsch || "";
    const sourceUrl = payload.source_url || payload.url || "";

    if (!resendKey) {
      console.log("RESEND ERROR: RESEND_API_KEY fehlt");
      return {
        statusCode: 500,
        body: JSON.stringify({
          success: false,
          error: "RESEND_API_KEY fehlt"
        })
      };
    }

    const html =
      '<div id="ps-kontaktanfrage">' +
      '<h2>Neue Objektanfrage über die Website</h2>' +
      '<p><strong>Objekt:</strong> ' + escapeHtml(objectTitle) + '</p>' +
      '<p><strong>Objekt-ID:</strong> ' + escapeHtml(objectId) + '</p>' +
      '<p><strong>Name:</strong> ' + escapeHtml(fullName) + '</p>' +
      '<p><strong>E-Mail:</strong> ' + escapeHtml(email) + '</p>' +
      '<p><strong>Telefon:</strong> ' + escapeHtml(phone) + '</p>' +
      '<p><strong>Kontaktwunsch:</strong> ' + escapeHtml(contactWish) + '</p>' +
      '<p><strong>Nachricht:</strong><br>' + escapeHtml(message).replace(/\n/g, "<br>") + '</p>' +
      '<p><strong>Quelle:</strong><br>' + escapeHtml(sourceUrl) + '</p>' +
      '<span id="client_name">' + escapeHtml(fullName) + '</span>' +
      '<span id="client_email">' + escapeHtml(email) + '</span>' +
      '<span id="client_phone">' + escapeHtml(phone) + '</span>' +
      '<span id="property_id">' + escapeHtml(objectId) + '</span>' +
      '<span id="unit_id">' + escapeHtml(objectId) + '</span>' +
      '<span id="body">' + escapeHtml(message) + '</span>' +
      '<span id="source">Website Objektanfrage</span>' +
      '</div>';

    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + resendKey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from,
        to,
        subject: "Neue Objektanfrage: " + objectTitle,
        html
      })
    });

    const resendText = await resendResponse.text();

    console.log("RESEND STATUS:", resendResponse.status);
    console.log("RESEND RESPONSE:", resendText);

    if (!resendResponse.ok) {
      return {
        statusCode: 500,
        body: JSON.stringify({
          success: false,
          error: "Resend Fehler",
          status: resendResponse.status,
          response: resendText
        })
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        message: "Portal-Anfrage-Mail wurde an Propstack gesendet"
      })
    };

  } catch (error) {
    console.log("FATAL ERROR:", error.message);

    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: error.message
      })
    };
  }
};

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
