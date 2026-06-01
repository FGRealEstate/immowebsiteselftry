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
            `Objekt-ID / Unit-ID: ${objectId}`,
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

        const contactResponse = await createContact(apiKey, {
            firstName,
            lastName,
            fullName,
            email,
            phone,
            note
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

        const stage = await findBestDealStage(apiKey);

        if (!stage || !stage.id) {
            return json(500, {
                success: false,
                error: "Keine passende Deal-Stage gefunden."
            });
        }

        console.log("Deal Stage gefunden:", stage);

        const dealResponse = await createDeal(apiKey, {
            contactId,
            objectId,
            stageId: stage.id,
            note
        });

        console.log("Deal erstellt:", dealResponse);

        return json(200, {
            success: true,
            message: "Objektanfrage erfolgreich übermittelt.",
            contact_id: contactId,
            deal_stage: stage,
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

async function createContact(apiKey, payload) {
    return await propstackPost(apiKey, "/contacts", {
        client: {
            first_name: payload.firstName,
            last_name: payload.lastName,
            name: payload.fullName,
            email: payload.email,
            phone: payload.phone || "",
            note: payload.note,
            source: "Website Objektanfrage"
        }
    });
}

async function createDeal(apiKey, payload) {
    return await propstackPost(apiKey, "/client_properties", {
        client_property: {
            client_id: payload.contactId,

            property_id: payload.objectId,
            unit_id: payload.objectId,

            deal_stage_id: payload.stageId,

            note: payload.note,
            source: "Website Objektanfrage"
        }
    });
}

async function findBestDealStage(apiKey) {
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

        const isBuyer =
            combined.includes("käufer") ||
            combined.includes("kaeufer") ||
            combined.includes("kauf") ||
            combined.includes("interessent") ||
            combined.includes("buyer");

        const isOwnerOrSeller =
            combined.includes("eigentümer") ||
            combined.includes("eigentuemer") ||
            combined.includes("verkäufer") ||
            combined.includes("verkaeufer") ||
            combined.includes("seller") ||
            combined.includes("owner");

        return isBuyer && !isOwnerOrSeller;
    });

    const preferredNames = [
        "200 käufer",
        "200 kaeufer",
        "neuer käufer-lead",
        "neuer kaeufer-lead",
        "käufer lead",
        "kaeufer lead",
        "interessent",
        "qualifiziert",
        "unqualifiziert"
    ];

    for (const preferredName of preferredNames) {
        const exact = buyerStages.find(stage =>
            normalizeText(stage.name) === preferredName
        );

        if (exact) return exact;
    }

    for (const preferredName of preferredNames) {
        const partial = buyerStages.find(stage =>
            normalizeText(`${stage.pipeline_name} ${stage.name}`).includes(preferredName)
        );

        if (partial) return partial;
    }

    if (buyerStages.length) {
        return buyerStages[0];
    }

    const safeFallback = allStages.find(stage => {
        const combined = normalizeText(`${stage.pipeline_name} ${stage.name}`);

        return (
            !combined.includes("eigentümer") &&
            !combined.includes("eigentuemer") &&
            !combined.includes("verkäufer") &&
            !combined.includes("verkaeufer")
        );
    });

    return safeFallback || allStages[0] || null;
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
        throw new Error(
            `Propstack Fehler ${response.status} bei ${endpoint}: ${JSON.stringify(data)}`
        );
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
    return String(value || "")
        .trim()
        .toLowerCase()
        .replace(/\s+/g, " ");
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
