const PROPSTACK_BASE_URL = "https://api.propstack.de/v1";

exports.handler = async function (event) {
    if (event.httpMethod !== "POST") {
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

        const {
            firstName,
            lastName,
            email,
            phone,
            message,
            propertyId,
            propertyTitle,
            marketingType,
            propertyType,
            location,
            price,
            url
        } = payload;

        if (!firstName || !lastName || !email || !propertyId) {
            return {
                statusCode: 400,
                body: JSON.stringify({
                    success: false,
                    error: "Pflichtfelder fehlen"
                })
            };
        }

        const apiKey = process.env.PROPSTACK_API_KEY;

        if (!apiKey) {
            throw new Error("PROPSTACK_API_KEY fehlt");
        }

        const note = `
Neue Objektanfrage über Website

Objekt:
${propertyTitle}

Objekt-ID:
${propertyId}

Vermarktung:
${marketingType || "-"}

Objektart:
${propertyType || "-"}

Standort:
${location || "-"}

Preis:
${price || "-"}

Objektlink:
${url || "-"}

Nachricht:
${message || "-"}
`;

        async function propstackRequest(endpoint, body) {
            const response = await fetch(`${PROPSTACK_BASE_URL}${endpoint}`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-API-KEY": apiKey
                },
                body: JSON.stringify(body)
            });

            const data = await response.json();

            if (!response.ok) {
                console.warn(
                    `Propstack Fehler bei ${endpoint}:`,
                    JSON.stringify(data)
                );

                throw new Error(
                    `Propstack Fehler ${response.status} bei ${endpoint}: ${JSON.stringify(data)}`
                );
            }

            return data;
        }

        async function createClient() {
            const body = {
                client: {
                    first_name: firstName,
                    last_name: lastName,
                    name: `${firstName} ${lastName}`,
                    email: email,
                    phone: phone || "",
                    note,
                    source: "Website Objektanfrage"
                }
            };

            const response = await propstackRequest("/contacts", body);

            return (
                response.contact?.id ||
                response.client?.id ||
                response.id
            );
        }

        async function createDeal(clientId) {
            const dealBody = {
                deal: {
                    title: `Objektanfrage – ${propertyTitle}`,
                    property_id: propertyId,
                    contact_id: clientId,
                    phase: "qualifiziert",
                    source: "Website",
                    note
                }
            };

            try {
                return await propstackRequest("/deals", dealBody);
            } catch (error) {
                console.warn("Deal konnte nicht erstellt werden:", error.message);
                return null;
            }
        }

        const clientId = await createClient();

        if (!clientId) {
            throw new Error("Kontakt konnte nicht erstellt werden");
        }

        await createDeal(clientId);

        return {
            statusCode: 200,
            body: JSON.stringify({
                success: true,
                message: "Objekt erfolgreich angefragt"
            })
        };

    } catch (error) {
        console.error("PROPSTACK INQUIRY ERROR:", error);

        return {
            statusCode: 500,
            body: JSON.stringify({
                success: false,
                error: error.message || "Serverfehler"
            })
        };
    }
};
