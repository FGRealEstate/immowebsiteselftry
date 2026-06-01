exports.handler = async function (event) {
    if (event.httpMethod !== "POST") {
        return response(405, {
            ok: false,
            message: "Method not allowed"
        });
    }

    const apiKey = process.env.PROPSTACK_API_KEY;

    if (!apiKey) {
        return response(500, {
            ok: false,
            message: "PROPSTACK_API_KEY fehlt."
        });
    }

    let data;

    try {
        data = JSON.parse(event.body || "{}");
    } catch (error) {
        return response(400, {
            ok: false,
            message: "Ungültige Anfrage."
        });
    }

    const firstName = clean(data.first_name);
    const lastName = clean(data.last_name);
    const email = clean(data.email);
    const phone = clean(data.phone);
    const objectId = clean(data.object_id);
    const objectTitle = clean(data.object_title);
    const sourceUrl = clean(data.source_url);
    const message = clean(data.message);
    const contactPreference = clean(data.contact_preference);

    if (!firstName || !lastName || !email || !objectId) {
        return response(400, {
            ok: false,
            message: "Pflichtfelder fehlen."
        });
    }

    const fullName = `${firstName} ${lastName}`.trim();

    try {
        const client = await createClient({
            apiKey,
            firstName,
            lastName,
            fullName,
            email,
            phone,
            objectTitle,
            objectId,
            sourceUrl,
            message,
            contactPreference
        });

        const clientId =
            client?.id ||
            client?.client?.id ||
            client?.contact?.id ||
            client?.data?.id ||
            null;

        const deal = await createDeal({
            apiKey,
            clientId,
            fullName,
            email,
            phone,
            objectId,
            objectTitle,
            message,
            sourceUrl,
            contactPreference
        });

        await createActivity({
            apiKey,
            clientId,
            fullName,
            email,
            phone,
            objectId,
            objectTitle,
            message,
            sourceUrl,
            contactPreference
        });

        return response(200, {
            ok: true,
            message: "Anfrage erfolgreich übermittelt.",
            client,
            deal
        });

    } catch (error) {
        console.error("PROPSTACK INQUIRY ERROR:", error);

        return response(500, {
            ok: false,
            message: error.message || "Propstack Anfrage fehlgeschlagen."
        });
    }
};

function clean(value) {
    if (value === null || value === undefined) return "";
    return String(value).trim();
}

function response(statusCode, body) {
    return {
        statusCode,
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
    };
}

async function propstackRequest(apiKey, endpoint, options = {}) {
    const url = `https://api.propstack.de/v1${endpoint}`;

    const res = await fetch(url, {
        ...options,
        headers: {
            "X-API-KEY": apiKey,
            "Content-Type": "application/json",
            "Accept": "application/json",
            ...(options.headers || {})
        }
    });

    const text = await res.text();

    let json = null;

    try {
        json = text ? JSON.parse(text) : null;
    } catch {
        json = { raw: text };
    }

    if (!res.ok) {
        throw new Error(`Propstack Fehler ${res.status} bei ${endpoint}: ${text}`);
    }

    return json;
}

async function tryPropstackRequests(apiKey, requests) {
    let lastError = null;

    for (const request of requests) {
        try {
            return await propstackRequest(apiKey, request.endpoint, {
                method: request.method || "POST",
                body: JSON.stringify(request.body)
            });
        } catch (error) {
            lastError = error;
            console.warn("Propstack Versuch fehlgeschlagen:", request.endpoint, error.message);
        }
    }

    throw lastError;
}

async function createClient(payload) {
    const note = buildNote(payload);

    return await tryPropstackRequests(payload.apiKey, [
        {
            endpoint: "/clients",
            body: {
                client: {
                    first_name: payload.firstName,
                    last_name: payload.lastName,
                    name: payload.fullName,
                    email: payload.email,
                    phone: payload.phone,
                    note,
                    source: "Website Objektanfrage"
                }
            }
        },
        {
            endpoint: "/clients",
            body: {
                first_name: payload.firstName,
                last_name: payload.lastName,
                name: payload.fullName,
                email: payload.email,
                phone: payload.phone,
                note,
                source: "Website Objektanfrage"
            }
        },
        {
            endpoint: "/contacts",
            body: {
                contact: {
                    first_name: payload.firstName,
                    last_name: payload.lastName,
                    name: payload.fullName,
                    email: payload.email,
                    phone: payload.phone,
                    note,
                    source: "Website Objektanfrage"
                }
            }
        }
    ]);
}

async function createDeal(payload) {
    const title = `Objektanfrage – ${payload.objectTitle} – ${payload.fullName}`;
    const note = buildNote(payload);

    return await tryPropstackRequests(payload.apiKey, [
        {
            endpoint: "/deals",
            body: {
                deal: {
                    title,
                    name: title,
                    property_id: payload.objectId,
                    unit_id: payload.objectId,
                    client_id: payload.clientId,
                    contact_id: payload.clientId,
                    stage: "Qualifiziert",
                    phase: "200 Käufer",
                    source: "Website Objektanfrage",
                    note
                }
            }
        },
        {
            endpoint: "/deals",
            body: {
                title,
                name: title,
                property_id: payload.objectId,
                unit_id: payload.objectId,
                client_id: payload.clientId,
                contact_id: payload.clientId,
                source: "Website Objektanfrage",
                note
            }
        }
    ]);
}

async function createActivity(payload) {
    const title = `Neue Objektanfrage: ${payload.objectTitle}`;
    const note = buildNote(payload);

    return await tryPropstackRequests(payload.apiKey, [
        {
            endpoint: "/activities",
            body: {
                activity: {
                    title,
                    subject: title,
                    body: note,
                    note,
                    property_id: payload.objectId,
                    unit_id: payload.objectId,
                    client_id: payload.clientId,
                    contact_id: payload.clientId,
                    kind: "note"
                }
            }
        },
        {
            endpoint: "/tasks",
            body: {
                task: {
                    title,
                    body: note,
                    note,
                    property_id: payload.objectId,
                    unit_id: payload.objectId,
                    client_id: payload.clientId,
                    contact_id: payload.clientId
                }
            }
        }
    ]);
}

function buildNote(payload) {
    return [
        "Neue Objektanfrage über die Website",
        "",
        `Objekt: ${payload.objectTitle}`,
        `Objekt-ID: ${payload.objectId}`,
        `Name: ${payload.fullName}`,
        `E-Mail: ${payload.email}`,
        `Telefon: ${payload.phone || "-"}`,
        `Kontaktwunsch: ${payload.contactPreference || "-"}`,
        "",
        "Nachricht:",
        payload.message || "-",
        "",
        `Quelle: ${payload.sourceUrl || "-"}`
    ].join("\n");
}
