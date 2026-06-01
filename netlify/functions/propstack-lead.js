const PROPSTACK_BASE_URL = "https://api.propstack.de/v1";

exports.handler = async function (event) {
    try {
        if (event.httpMethod !== "POST") {
            return json(405, { success: false, error: "Method not allowed" });
        }

        const apiKey = process.env.PROPSTACK_API_KEY;

        if (!apiKey) {
            return json(500, { success: false, error: "PROPSTACK_API_KEY fehlt" });
        }

        const data = JSON.parse(event.body || "{}");

        const firstName = clean(data.first_name);
        const lastName = clean(data.last_name);
        const email = clean(data.email);
        const phone = clean(data.phone);
        const concern = clean(data.concern);
        const objectType = clean(data.object_type);
        const location = clean(data.location);
        const budget = clean(data.budget);
        const timeframe = clean(data.timeframe);
        const contactPreference = clean(data.contact_preference);
        const message = clean(data.message);
        const consent = data.privacy_consent === true || data.privacy_consent === "true";
        const sourceUrl = clean(data.source_url);

        if (!firstName || !lastName || !email || !concern || !consent) {
            return json(400, {
                success: false,
                error: "Pflichtfelder oder Datenschutz-Einwilligung fehlen."
            });
        }

        const fullName = `${firstName} ${lastName}`.trim();

        const note = [
            "Neue Website-Landingpage-Anfrage",
            "",
            `Name: ${fullName}`,
            `E-Mail: ${email}`,
            `Telefon: ${phone || "-"}`,
            `Anliegen: ${concern}`,
            `Objektart: ${objectType || "-"}`,
            `Ort / Suchgebiet: ${location || "-"}`,
            `Budget / Preisrahmen: ${budget || "-"}`,
            `Zeitrahmen: ${timeframe || "-"}`,
            `Kontaktwunsch: ${contactPreference || "-"}`,
            "",
            "Nachricht:",
            message || "-",
            "",
            "Einwilligung:",
            "Datenschutz-Einwilligung wurde aktiv bestätigt.",
            `Zeitpunkt: ${new Date().toISOString()}`,
            `Quelle: ${sourceUrl || "-"}`
        ].join("\n");

        const contactResponse = await propstackPost(apiKey, "/contacts", {
            client: {
                first_name: firstName,
                last_name: lastName,
                name: fullName,
                email: email,
                phone: phone || "",
                source: "Website Landingpage",
                note: note
            }
        });

        const contactId =
            contactResponse?.client?.id ||
            contactResponse?.contact?.id ||
            contactResponse?.id ||
            contactResponse?.data?.id ||
            null;

        return json(200, {
            success: true,
            message: "Ihre Anfrage wurde erfolgreich übermittelt.",
            contact_id: contactId,
            contact: contactResponse
        });

    } catch (error) {
        console.error("PROPSTACK LEAD ERROR:", error.message);

        return json(500, {
            success: false,
            error: error.message
        });
    }
};

function clean(value) {
    if (value === null || value === undefined) return "";
    return String(value).trim();
}

function json(statusCode, body) {
    return {
        statusCode,
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
    };
}

async function propstackPost(apiKey, endpoint, body) {
    const response = await fetch(`${PROPSTACK_BASE_URL}${endpoint}`, {
        method: "POST",
        headers: {
            "X-API-KEY": apiKey,
            "Content-Type": "application/json",
            "Accept": "application/json"
        },
        body: JSON.stringify(body)
    });

    const text = await response.text();

    let data;
    try {
        data = text ? JSON.parse(text) : {};
    } catch {
        data = { raw: text };
    }

    if (!response.ok) {
        throw new Error(`Propstack Fehler ${response.status} bei ${endpoint}: ${JSON.stringify(data)}`);
    }

    return data;
}
