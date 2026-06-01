const PROPSTACK_BASE_URL = "https://api.propstack.de/v1";

exports.handler = async function (event) {
    try {
        if (event.httpMethod !== "POST") {
            return json(405, {
                success: false,
                error: "Method not allowed"
            });
        }

        const apiKey = process.env.PROPSTACK_API_KEY;

        if (!apiKey) {
            return json(500, {
                success: false,
                error: "PROPSTACK_API_KEY fehlt"
            });
        }

        const data = JSON.parse(event.body || "{}");

        const firstName = clean(data.first_name || data.firstName);
        const lastName = clean(data.last_name || data.lastName);
        const email = clean(data.email);
        const phone = clean(data.phone);
        const message = clean(data.message);
        const contactPreference = clean(data.contact_preference);
        const objectId = clean(data.object_id || data.propertyId);
        const objectTitle = clean(data.object_title || data.propertyTitle);
        const sourceUrl = clean(data.source_url || data.url);

        if (!firstName || !lastName || !email || !objectId) {
            return json(400, {
                success: false,
                error: "Pflichtfelder fehlen",
                received: {
                    firstName,
                    lastName,
                    email,
                    objectId
                }
            });
        }

        const fullName = `${firstName} ${lastName}`.trim();

        const note = [
            "Neue Objektanfrage über die Website",
            "",
            `Objekt: ${objectTitle || "-"}`,
            `Objekt-ID: ${objectId}`,
            `Name: ${fullName}`,
            `E-Mail: ${email}`,
            `Telefon: ${phone || "-"}`,
            `Kontaktwunsch: ${contactPreference || "-"}`,
            "",
            "Nachricht:",
            message || "-",
            "",
            `Quelle: ${sourceUrl || "-"}`
        ].join("\n");

        console.log("Neue Objektanfrage:", {
            objectId,
            objectTitle,
            fullName,
            email
        });

        const contactResponse = await propstackPost(apiKey, "/contacts", {
            client: {
                first_name: firstName,
                last_name: lastName,
                name: fullName,
                email: email,
                phone: phone || "",
                note: note,
                source: "Website Objektanfrage"
            }
        });

        const contactId =
            contactResponse?.client?.id ||
            contactResponse?.contact?.id ||
            contactResponse?.id ||
            contactResponse?.data?.id ||
            null;

        if (!contactId) {
            return json(500, {
                success: false,
                error: "Kontakt wurde erstellt, aber keine Kontakt-ID erhalten.",
                propstack_response: contactResponse
            });
        }

        console.log("Kontakt erstellt:", contactId);

        const dealResponse = await propstackPost(apiKey, "/client_properties", {
            client_property: {
                client_id: contactId,
                property_id: objectId,
                deal_stage_id: 200,
                note: note,
                source: "Website Objektanfrage"
            }
        });

        console.log("Deal erstellt:", dealResponse);

        return json(200, {
            success: true,
            message: "Objektanfrage erfolgreich übermittelt.",
            contact_id: contactId,
            contact: contactResponse,
            deal: dealResponse
        });

    } catch (error) {
        console.error("PROPSTACK INQUIRY ERROR:", error.message);

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
        throw new Error(
            `Propstack Fehler ${response.status} bei ${endpoint}: ${JSON.stringify(data)}`
        );
    }

    return data;
}
