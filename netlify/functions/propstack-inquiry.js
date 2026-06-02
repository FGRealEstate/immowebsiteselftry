const PROPSTACK_BASE_URL = process.env.PROPSTACK_API_BASE || "https://api.propstack.de/v1";

/*
 * Objektanfrage Website → Propstack
 *
 * Ziel:
 * - Kontakt anlegen/aktualisieren
 * - Käufer-Deal am Objekt in Pipeline "200 Käufer" anlegen
 * - optional eine Anfrage-Notiz mit client_source_id erzeugen
 *
 * Wichtig für Propstack-Automatisierungen:
 * Lege in Netlify zusätzlich diese Environment Variable an, sobald du die ID der Quelle kennst:
 * PROPSTACK_WEBSITE_SOURCE_ID=<ID der Kontaktquelle "Website Objektanfrage">
 */

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

        const firstName = clean(data.first_name || data.firstName);
        const lastName = clean(data.last_name || data.lastName);
        const email = clean(data.email);
        const phone = clean(data.phone);
        const message = clean(data.message);
        const contactPreference = clean(data.contact_preference);
        const objectId = clean(data.object_id || data.propertyId);
        const objectTitle = clean(data.object_title || data.propertyTitle);
        const sourceUrl = clean(data.source_url || data.url);
        const privacyConsent = data.privacy_consent === true || data.privacy_consent === "true" || data.datenschutz === true;

        if (!firstName || !lastName || !email || !objectId) {
            return json(400, {
                success: false,
                error: "Pflichtfelder fehlen",
                received: { firstName, lastName, email, objectId }
            });
        }

        const fullName = `${firstName} ${lastName}`.trim();

        const note = [
            "Neue Objektanfrage über die Website",
            "",
            `Objekt: ${objectTitle || "-"}`,
            `Objekt-ID / Unit-ID: ${objectId}`,
            `Name: ${fullName}`,
            `E-Mail: ${email}`,
            `Telefon: ${phone || "-"}`,
            `Kontaktwunsch: ${contactPreference || "-"}`,
            "",
            "Nachricht:",
            message || "-",
            "",
            "Einwilligung:",
            privacyConsent ? "Datenschutz-Einwilligung wurde aktiv bestätigt." : "Keine gesonderte Datenschutz-Info im Payload erkannt.",
            `Zeitpunkt: ${new Date().toISOString()}`,
            `Quelle: ${sourceUrl || "-"}`
        ].join("\n");

        console.log("Neue Objektanfrage:", { objectId, objectTitle, fullName, email });

        const contactResponse = await createContact(apiKey, {
            firstName,
            lastName,
            fullName,
            email,
            phone,
            note,
            contactPreference
        });

        const contactId = extractId(contactResponse);
        if (!contactId) {
            return json(500, {
                success: false,
                error: "Kontakt wurde erstellt, aber keine Kontakt-ID erhalten.",
                propstack_response: contactResponse
            });
        }

        console.log("Kontakt erstellt:", contactId);

        const stage = await findBestBuyerDealStage(apiKey);
        if (!stage || !stage.id) {
            return json(500, {
                success: false,
                error: "Keine passende Käufer-Deal-Stage gefunden."
            });
        }

        console.log("Käufer-Deal-Stage gefunden:", stage);

        const dealResponse = await createDeal(apiKey, {
            contactId,
            objectId,
            stageId: stage.id,
            note
        });

        console.log("Deal erstellt:", dealResponse);

        const portalSignal = await createPortalInquirySignal(apiKey, {
            contactId,
            objectId,
            objectTitle,
            note
        });

        return json(200, {
            success: true,
            message: "Objektanfrage erfolgreich übermittelt.",
            contact_id: contactId,
            deal_stage: stage,
            contact: contactResponse,
            deal: dealResponse,
            portal_signal: portalSignal
        });

    } catch (error) {
        console.error("PROPSTACK INQUIRY ERROR:", error.message);
        return json(500, { success: false, error: error.message });
    }
};

async function createContact(apiKey, payload) {
    return await propstackPost(apiKey, "/contacts", {
        client: removeEmpty({
            first_name: payload.firstName,
            last_name: payload.lastName,
            name: payload.fullName,
            email: payload.email,
            phone: payload.phone || "",
            note: payload.note,
            source: "Website Objektanfrage",
            buyer: true,
            partial_custom_fields: removeEmpty({
                website_lead: true,
                landingpage_typ: "Kauf",
                finanzierungsberatung_gewunscht: "",
                suchgebiet: "",
                objektadresse: "",
                budget: "",
                zeitrahmen: "",
                offmarket_geeignet: false
            })
        })
    });
}

async function createDeal(apiKey, payload) {
    return await propstackPost(apiKey, "/client_properties", {
        client_property: removeEmpty({
            client_id: payload.contactId,
            contact_id: payload.contactId,
            property_id: payload.objectId,
            unit_id: payload.objectId,
            deal_stage_id: payload.stageId,
            note: payload.note,
            source: "Website Objektanfrage"
        })
    });
}

/*
 * Optionaler Trigger für Propstack-Automatisierungen:
 * Wenn PROPSTACK_WEBSITE_SOURCE_ID gesetzt ist, versucht die Function zusätzlich,
 * eine echte Anfrage-/Notizspur mit client_source_id zu schreiben.
 * Falls der konkrete Endpoint bei eurem Account anders reagiert, blockiert das NICHT den Lead.
 */
async function createPortalInquirySignal(apiKey, payload) {
    const sourceId = clean(process.env.PROPSTACK_WEBSITE_SOURCE_ID);
    if (!sourceId) {
        return { skipped: true, reason: "PROPSTACK_WEBSITE_SOURCE_ID nicht gesetzt" };
    }

    const attempts = [
        {
            endpoint: "/notes",
            body: {
                note: removeEmpty({
                    title: "Website Objektanfrage",
                    body: payload.note,
                    text: payload.note,
                    client_id: payload.contactId,
                    contact_id: payload.contactId,
                    property_id: payload.objectId,
                    unit_id: payload.objectId,
                    client_source_id: sourceId,
                    kind: "note"
                })
            }
        },
        {
            endpoint: "/tasks",
            body: {
                task: removeEmpty({
                    title: `Website Anfrage: ${payload.objectTitle || payload.objectId}`,
                    body: payload.note,
                    note: payload.note,
                    client_id: payload.contactId,
                    contact_id: payload.contactId,
                    property_id: payload.objectId,
                    unit_id: payload.objectId,
                    client_source_id: sourceId
                })
            }
        }
    ];

    const results = [];

    for (const attempt of attempts) {
        try {
            const result = await propstackPost(apiKey, attempt.endpoint, attempt.body);
            return { ok: true, endpoint: attempt.endpoint, result };
        } catch (error) {
            console.warn(`Portal-Signal fehlgeschlagen bei ${attempt.endpoint}:`, error.message);
            results.push({ endpoint: attempt.endpoint, ok: false, error: error.message });
        }
    }

    return { ok: false, attempts: results };
}

async function findBestBuyerDealStage(apiKey) {
    const pipelinesResponse = await propstackGet(apiKey, "/deal_pipelines");
    const pipelines = normalizeArray(pipelinesResponse);

    const allStages = [];

    for (const pipeline of pipelines) {
        const pipelineName = pipeline.name || pipeline.title || pipeline.label || "";

        const stages =
            pipeline.deal_stages ||
            pipeline.stages ||
            pipeline.client_property_stages ||
            [];

        for (const stage of stages) {
            allStages.push({
                id: stage.id,
                name: stage.name || stage.title || stage.label || "",
                pipeline_id: pipeline.id,
                pipeline_name: pipelineName,
                raw: stage
            });
        }
    }

    console.log("Gefundene Deal-Stages:", allStages.map(stage => ({
        id: stage.id,
        name: stage.name,
        pipeline_id: stage.pipeline_id,
        pipeline_name: stage.pipeline_name
    })));

    const buyerStages = allStages.filter(stage => {
        const combined = normalizeText(`${stage.pipeline_name} ${stage.name}`);

        const isBuyerPipeline =
            combined.includes("200 kaufer") ||
            combined.includes("200 kaeufer") ||
            combined.includes("kaeufer") ||
            combined.includes("kaufer") ||
            combined.includes("kaufinteressent") ||
            combined.includes("buyer");

        const isWrongPipeline =
            combined.includes("100 eigentumer") ||
            combined.includes("100 eigentuemer") ||
            combined.includes("eigentumer") ||
            combined.includes("eigentuemer") ||
            combined.includes("verkaufer") ||
            combined.includes("verkaeufer") ||
            combined.includes("300 mieter") ||
            combined.includes("400 finanzierung");

        return isBuyerPipeline && !isWrongPipeline;
    });

    const preferredNames = [
        "neuer kaufer lead",
        "neuer kaeufer lead",
        "neuer kaufinteressent",
        "kaufinteressent",
        "unqualifiziert",
        "qualifiziert"
    ];

    for (const preferredName of preferredNames) {
        const exact = buyerStages.find(stage => normalizeText(stage.name) === preferredName);
        if (exact) return exact;
    }

    for (const preferredName of preferredNames) {
        const partial = buyerStages.find(stage =>
            normalizeText(`${stage.pipeline_name} ${stage.name}`).includes(preferredName)
        );
        if (partial) return partial;
    }

    if (buyerStages.length) return buyerStages[0];

    throw new Error("Keine Käufer-Stage gefunden. Bitte Pipeline 200 Käufer prüfen oder API-Rechte für Deal-Pipelines aktivieren.");
}

async function propstackGet(apiKey, endpoint) {
    const response = await fetch(`${PROPSTACK_BASE_URL}${endpoint}`, {
        method: "GET",
        headers: { "X-API-KEY": apiKey, "Accept": "application/json" }
    });

    return await parsePropstackResponse(response, endpoint);
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

    return await parsePropstackResponse(response, endpoint);
}

async function parsePropstackResponse(response, endpoint) {
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

function normalizeArray(value) {
    if (Array.isArray(value)) return value;
    if (Array.isArray(value?.deal_pipelines)) return value.deal_pipelines;
    if (Array.isArray(value?.pipelines)) return value.pipelines;
    if (Array.isArray(value?.data)) return value.data;
    if (Array.isArray(value?.items)) return value.items;
    return [];
}

function extractId(response) {
    return (
        response?.client?.id ||
        response?.contact?.id ||
        response?.id ||
        response?.data?.id ||
        null
    );
}

function clean(value) {
    if (value === null || value === undefined) return "";
    return String(value).trim();
}

function normalizeText(value) {
    return clean(value)
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/ä/g, "ae")
        .replace(/ö/g, "oe")
        .replace(/ü/g, "ue")
        .replace(/ß/g, "ss")
        .replace(/[^a-z0-9]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function removeEmpty(object) {
    const result = {};
    for (const [key, value] of Object.entries(object)) {
        if (value === null || value === undefined || value === "") continue;
        if (Array.isArray(value) && value.length === 0) continue;
        if (Object.prototype.toString.call(value) === "[object Object]" && Object.keys(value).length === 0) continue;
        result[key] = value;
    }
    return result;
}

function json(statusCode, body) {
    return {
        statusCode,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
    };
}
