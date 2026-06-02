```js
const axios = require("axios");

const {
  PROPSTACK_API_BASE,
  PROPSTACK_API_KEY,
  RESEND_API_KEY,
  PROPSTACK_PORTAL_INQUIRY_EMAIL,
  PROPSTACK_EMAIL_FROM,
  MAIL_FROM
} = process.env;

exports.handler = async (event) => {
  console.log("=================================================");
  console.log("PROPSTACK INQUIRY START");
  console.log("=================================================");

  console.log("REQUEST METHOD:", event.httpMethod);

  if (event.httpMethod !== "POST") {
    console.log("Method not allowed");
    return {
      statusCode: 405,
      body: JSON.stringify({
        success: false,
        error: "Method not allowed"
      })
    };
  }

  try {
    const payload = JSON.parse(event.body || "{}");

    console.log("PAYLOAD:");
    console.log(JSON.stringify(payload, null, 2));

    const {
      objectId,
      objectTitle,
      fullName,
      email,
      phone,
      message,
      contactWish,
      privacyAccepted
    } = payload;

    console.log("=================================================");
    console.log("ENV DEBUG");
    console.log("=================================================");

    console.log("PROPSTACK_API_BASE:", !!PROPSTACK_API_BASE);
    console.log("PROPSTACK_API_KEY:", !!PROPSTACK_API_KEY);
    console.log("RESEND_API_KEY:", !!RESEND_API_KEY);
    console.log(
      "PROPSTACK_PORTAL_INQUIRY_EMAIL:",
      PROPSTACK_PORTAL_INQUIRY_EMAIL
    );
    console.log(
      "PROPSTACK_EMAIL_FROM:",
      PROPSTACK_EMAIL_FROM
    );
    console.log(
      "MAIL_FROM:",
      MAIL_FROM
    );

    const finalMailFrom =
      PROPSTACK_EMAIL_FROM ||
      MAIL_FROM ||
      "info@fg-realestate.de";

    const finalPortalMail =
      PROPSTACK_PORTAL_INQUIRY_EMAIL ||
      "info@fg-realestate.de";

    console.log("FINAL FROM:", finalMailFrom);
    console.log("FINAL TO:", finalPortalMail);

    console.log("=================================================");
    console.log("RESEND TEST");
    console.log("=================================================");

    let resendWorked = false;

    if (RESEND_API_KEY) {
      try {
        const resendResponse = await axios.post(
          "https://api.resend.com/emails",
          {
            from: finalMailFrom,
            to: [finalPortalMail],
            subject: `Neue Objektanfrage: ${objectTitle || "Objekt"}`,
            html: `
              <h2>Neue Objektanfrage</h2>

              <p><strong>Objekt:</strong> ${objectTitle || "-"}</p>
              <p><strong>Objekt-ID:</strong> ${objectId || "-"}</p>

              <hr>

              <p><strong>Name:</strong> ${fullName || "-"}</p>
              <p><strong>E-Mail:</strong> ${email || "-"}</p>
              <p><strong>Telefon:</strong> ${phone || "-"}</p>

              <p><strong>Kontaktwunsch:</strong> ${contactWish || "-"}</p>

              <hr>

              <p><strong>Nachricht:</strong></p>
              <p>${message || "-"}</p>

              <hr>

              <p><strong>Datenschutz akzeptiert:</strong> ${
                privacyAccepted ? "Ja" : "Nein"
              }</p>
            `
          },
          {
            headers: {
              Authorization: `Bearer ${RESEND_API_KEY}`,
              "Content-Type": "application/json"
            }
          }
        );

        console.log("=================================================");
        console.log("RESEND SUCCESS");
        console.log("=================================================");

        console.log(
          JSON.stringify(resendResponse.data, null, 2)
        );

        resendWorked = true;
      } catch (resendError) {
        console.log("=================================================");
        console.log("RESEND ERROR");
        console.log("=================================================");

        if (resendError.response) {
          console.log(
            JSON.stringify(resendError.response.data, null, 2)
          );
        } else {
          console.log(resendError.message);
        }
      }
    } else {
      console.log("NO RESEND API KEY FOUND");
    }

    console.log("=================================================");
    console.log("PROPSTACK CONTACT");
    console.log("=================================================");

    const contactResponse = await axios.post(
      `${PROPSTACK_API_BASE}/contacts`,
      {
        first_name: fullName || "Unbekannt",
        email: email || "",
        phone: phone || ""
      },
      {
        headers: {
          "X-API-KEY": PROPSTACK_API_KEY,
          "Content-Type": "application/json"
        }
      }
    );

    console.log("CONTACT CREATED:");
    console.log(JSON.stringify(contactResponse.data, null, 2));

    const contactId = contactResponse.data.id;

    console.log("=================================================");
    console.log("LOAD DEAL STAGES");
    console.log("=================================================");

    const stagesResponse = await axios.get(
      `${PROPSTACK_API_BASE}/deal_stages`,
      {
        headers: {
          "X-API-KEY": PROPSTACK_API_KEY
        }
      }
    );

    const stages = stagesResponse.data || [];

    console.log("ALL STAGES:");
    console.log(JSON.stringify(stages, null, 2));

    const buyerStage = stages.find(
      (s) =>
        s.pipeline_name &&
        s.pipeline_name.includes("Käufer") &&
        s.name &&
        s.name.includes("Neuer Kaufinteressent")
    );

    console.log("BUYER STAGE:");
    console.log(JSON.stringify(buyerStage, null, 2));

    console.log("=================================================");
    console.log("CREATE DEAL");
    console.log("=================================================");

    const dealResponse = await axios.post(
      `${PROPSTACK_API_BASE}/deals`,
      {
        title: `${objectTitle || "Objekt"} - ${fullName || "Kontakt"}`,
        contact_id: contactId,
        deal_stage_id: buyerStage ? buyerStage.id : null,
        note: `
Neue Objektanfrage über die Website

Objekt: ${objectTitle || "-"}
Objekt-ID / Unit-ID: ${objectId || "-"}

Name: ${fullName || "-"}
E-Mail: ${email || "-"}
Telefon: ${phone || "-"}

Kontaktwunsch: ${contactWish || "-"}

Nachricht:
${message || "-"}

Einwilligung:
${privacyAccepted ? "Datenschutz akzeptiert" : "Keine Datenschutz-Info"}

Zeitpunkt: ${new Date().toISOString()}
        `
      },
      {
        headers: {
          "X-API-KEY": PROPSTACK_API_KEY,
          "Content-Type": "application/json"
        }
      }
    );

    console.log("DEAL CREATED:");
    console.log(JSON.stringify(dealResponse.data, null, 2));

    console.log("=================================================");
    console.log("FINAL RESULT");
    console.log("=================================================");

    console.log("RESEND WORKED:", resendWorked);

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        resendWorked,
        contactId,
        dealId: dealResponse.data.id || null
      })
    };
  } catch (error) {
    console.log("=================================================");
    console.log("FATAL ERROR");
    console.log("=================================================");

    if (error.response) {
      console.log(
        JSON.stringify(error.response.data, null, 2)
      );
    } else {
      console.log(error.message);
    }

    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: error.message
      })
    };
  }
};
```
