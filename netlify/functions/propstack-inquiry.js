const PROPSTACK_BASE_URL = process.env.PROPSTACK_API_BASE || "https://api.propstack.de/v1";

exports.handler = async function (event) {
    try {
        console.log("PROPSTACK INQUIRY START");

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
        const contactPreference = clean(data.contact_preference || data.contactPreference);
        const objectId = clean(data.object_id || data.propertyId);
        const objectTitle = clean(data.object_title || data.propertyTitle);
        const sourceUrl = clean(data.source_url || data.url);

        const privacyConsent =
            data.privacy_consent === true ||
            data.privacy_consent === "true" ||
            data.datenschutz === true ||
            data.datenschutz === "true" ||
            data.consent === true ||
            data.consent === "true";

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

        const note = buildNote({
            firstName,
            lastName,
            fullName,
            email,
            phone,
            message,
            contactPreference,
            objectId,
            objectTitle,
            sourceUrl,
            privacyConsent
        });

        console.log("Neue Objektanfrage:", {
            objectId,
            objectTitle,
            fullName,
            email
        });

        /*
         * PRIO 1:
         * Wenn RESEND_API_KEY gesetzt ist, senden wir eine echte Propstack-lesbare Anfrage-Mail.
         * Dadurch können eure Propstack-Automationen wie "Neue Portal-Anfrage" greifen.
         *
         * Wichtig:
         * Netlify-ENV setzen:
         * RESEND_API_KEY=...
         * PROPSTACK_PORTAL_INQUIRY_EMAIL=info@fg-realestate.de
         * PROPSTACK_EMAIL_FROM=info@fg-realestate.de
         */
        const portalMailResult = await sendPropstackPortalInquiryMail({
            firstName,
            lastName,
            fullName,
            email,
            phone,
            message,
            contactPreference,
            objectId,
            objectTitle,
            sourceUrl,
            privacyConsent
        });

        if (portalMailResult.sent) {
            console.log("Propstack Portal-Anfrage-Mail gesendet:", portalMailResult);

            return json(200, {
                success: true,
                mode: "portal_mail",
                message: "Objektanfrage erfolgreich an Propstack übergeben.",
                portal_mail: portalMailResult
            });
        }

        /*
         * FALLBACK:
         * Wenn kein Mailversand eingerichtet ist, erstellen wir Kontakt + Deal direkt per API.
         * Das funktioniert für CRM-Eintrag, löst aber NICHT zwingend eure Portal-Anfrage-Automails aus.
         */
        console.log("Portal-Mail nicht gesendet, API-Fallback wird genutzt:", portalMailResult);

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

        return json(200, {
            success: true,
            mode: "api_fallback",
            message: "Objektanfrage erfolgreich per API übermittelt. Hinweis: Portal-Automails benötigen RESEND_API_KEY.",
            contact_id: contactId,
            deal_stage: stage,
            contact: contactResponse,
            deal: dealResponse,
            portal_mail: portalMailResult
        });

    } catch (error) {
        console.error("PROPSTACK INQUIRY ERROR:", error.message);

        return json(500, {
            success: false,
            error: error.message
        });
    }
};

function buildNote(payload) {
    return [
        "Neue Objektanfrage über die Website",
        "",
        `Objekt: ${payload.objectTitle || "-"}`,
        `Objekt-ID / Unit-ID: ${payload.objectId}`,
        `Name: ${payload.fullName}`,
        `E-Mail: ${payload.email}`,
        `Telefon: ${payload.phone || "-"}`,
        `Kontaktwunsch: ${payload.contactPreference || "-"}`,
        "",
        "Nachricht:",
        payload.message || "-",
        "",
        "Einwilligung:",
        payload.privacyConsent
            ? "Datenschutz-Einwilligung wurde aktiv bestätigt."
            : "Keine gesonderte Datenschutz-Info im Payload erkannt.",
        `Zeitpunkt: ${new Date().toISOString()}`,
        `Quelle: ${payload.sourceUrl || "-"}`
    ].join("\n");
}

async function sendPropstackPortalInquiryMail(payload) {
    const resendApiKey = clean(process.env.RESEND_API_KEY);
    const to = clean(process.env.PROPSTACK_PORTAL_INQUIRY_EMAIL || "info@fg-realestate.de");
    const from = clean(process.env.PROPSTACK_EMAIL_FROM || "info@fg-realestate.de");

    if (!resendApiKey) {
        return {
            sent: false,
            skipped: true,
            reason: "RESEND_API_KEY nicht gesetzt"
        };
    }

    const subject = `Website Objektanfrage: ${payload.objectTitle || payload.objectId}`;

    const html = buildPropstackInquiryHtml(payload);

    const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${resendApiKey}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            from,
            to,
            subject,
            html
        })
    });

    const text = await response.text();

    let result;
    try {
        result = text ? JSON.parse(text) : {};
    } catch {
        result = { raw: text };
    }

    if (!response.ok) {
        return {
            sent: false,
            skipped: false,
            reason: "Resend Mailversand fehlgeschlagen",
            status: response.status,
            response: result
        };
    }

    return {
        sent: true,
        to,
        from,
        subject,
        response: result
    };
}

function buildPropstackInquiryHtml(payload) {
    const safeMessage = escapeHtml(payload.message || "-");
    const safeObjectTitle = escapeHtml(payload.objectTitle || "-");
    const safeSourceUrl = escapeHtml(payload.sourceUrl || "-");

    return `
<div id="ps-kontaktanfrage">
    <p><strong>Neue Objektanfrage über die Website</strong></p>

    <p>
        <strong>Objekt:</strong> ${safeObjectTitle}<br>
        <strong>Objekt-ID:</strong> ${escapeHtml(payload.objectId)}<br>
        <strong>Name:</strong> ${escapeHtml(payload.fullName)}<br>
        <strong>E-Mail:</strong> ${escapeHtml(payload.email)}<br>
        <strong>Telefon:</strong> ${escapeHtml(payload.phone || "-")}<br>
        <strong>Kontaktwunsch:</strong> ${escapeHtml(payload.contactPreference || "-")}
    </p>

    <p>
        <strong>Nachricht:</strong><br>
        ${safeMessage.replace(/\n/g, "<br>")}
    </p>

    <p>
        <strong>Einwilligung:</strong><br>
        ${payload.privacyConsent ? "Datenschutz-Einwilligung wurde aktiv bestätigt." : "Keine gesonderte Datenschutz-Info im Payload erkannt."}
    </p>

    <p>
        <strong>Quelle:</strong><br>
        ${safeSourceUrl}
    </p>

    <span id="client_first_name">${escapeHtml(payload.firstName)}</span>
    <span id="client_last_name">${escapeHtml(payload.lastName)}</span>
    <span id="client_name">${escapeHtml(payload.fullName)}</span>
    <span id="client_email">${escapeHtml(payload.email)}</span>
    <span id="client_phone">${escapeHtml(payload.phone || "")}</span>
    <span id="property_id">${escapeHtml(payload.objectId)}</span>
    <span id="unit_id">${escapeHtml(payload.objectId)}</span>
    <span id="body">${safeMessage}</span>
    <span id="message">${safeMessage}</span>
    <span id="source">Website Objektanfrage</span>
</div>
`;
}

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

async function findBestBuyerDealStage(apiKey) {
    const pipelinesResponse = await propstackGet(apiKey, "/deal_pipelines");
    const pipelines = normalizeArray(pipelinesResponse);

    const allStages = [];

    for (const pipeline of pipelines) {
        const pipelineName =
            pipeline.name ||
            pipeline.title ||
            pipeline.label ||
            "";

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
        headers: {
            "X-API-KEY": apiKey,
            "Accept": "application/json"
        }
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
        if (
            Object.prototype.toString.call(value) === "[object Object]" &&
            Object.keys(value).length === 0
        ) continue;

        result[key] = value;
    }

    return result;
}

function escapeHtml(value) {
    return clean(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
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
