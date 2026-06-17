/*
 * Datei: netlify/functions/propstack-build-hook.js
 *
 * Zweck:
 * Propstack soll NICHT direkt den Netlify Build Hook aufrufen.
 * Stattdessen ruft Propstack diese Function auf.
 *
 * Diese Function prüft den Objektstatus.
 * Nur wenn der Status "Vermarktung" enthält, wird der echte Netlify Build Hook ausgelöst.
 *
 * Netlify Environment Variable benötigt:
 * NETLIFY_BUILD_HOOK_URL = die echte bisherige Netlify Build-Hook-URL
 *
 * Optional:
 * PROPSTACK_PUBLIC_STATUS_KEYWORDS = vermarktung
 */

function normalizeText(input) {
    return String(input || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "");
}

function findStatus(input) {
    if (!input || typeof input !== "object") return null;

    const candidates = [
        input.status,
        input.status_name,
        input.property_status,
        input.property_status_name,
        input.marketing_status,
        input.object_status,
        input.objekt_status,
        input?.custom_fields?.status,
        input?.custom_fields?.objekt_status,
        input?.data?.status,
        input?.data?.status_name,
        input?.data?.property_status,
        input?.data?.property_status_name,
        input?.data?.marketing_status,
        input?.data?.custom_fields?.status,
        input?.data?.custom_fields?.objekt_status,
        input?.unit?.status,
        input?.unit?.status_name,
        input?.unit?.property_status,
        input?.unit?.property_status_name,
        input?.unit?.marketing_status,
        input?.unit?.custom_fields?.status,
        input?.unit?.custom_fields?.objekt_status,
        input?.object?.status,
        input?.object?.status_name,
        input?.object?.property_status,
        input?.object?.property_status_name,
        input?.object?.marketing_status,
        input?.object?.custom_fields?.status,
        input?.object?.custom_fields?.objekt_status
    ];

    for (const candidate of candidates) {
        if (candidate === null || candidate === undefined) continue;

        if (typeof candidate === "object") {
            const nested =
                candidate.pretty_value ||
                candidate.value ||
                candidate.name ||
                candidate.label ||
                candidate.title;

            if (nested) return String(nested);
            continue;
        }

        if (String(candidate).trim()) return String(candidate);
    }

    return null;
}

exports.handler = async function(event) {
    if (event.httpMethod !== "POST") {
        return {
            statusCode: 405,
            body: "Method Not Allowed"
        };
    }

    let payload = {};

    try {
        payload = event.body ? JSON.parse(event.body) : {};
    } catch (error) {
        return {
            statusCode: 400,
            body: "Invalid JSON payload"
        };
    }

    const status = findStatus(payload);
    const normalizedStatus = normalizeText(status);

    const allowedKeywords = String(process.env.PROPSTACK_PUBLIC_STATUS_KEYWORDS || "vermarktung")
        .split(",")
        .map((item) => normalizeText(item))
        .filter(Boolean);

    const shouldBuild = allowedKeywords.some((keyword) => normalizedStatus.includes(keyword));

    if (!shouldBuild) {
        console.log("Propstack Build übersprungen. Status:", status || "kein Status gefunden");

        return {
            statusCode: 200,
            body: JSON.stringify({
                ok: true,
                skipped: true,
                reason: "Objekt ist nicht im öffentlichen Vermarktungsstatus.",
                status: status || null
            })
        };
    }

    const buildHookUrl = process.env.NETLIFY_BUILD_HOOK_URL;

    if (!buildHookUrl) {
        return {
            statusCode: 500,
            body: "NETLIFY_BUILD_HOOK_URL fehlt."
        };
    }

    const response = await fetch(buildHookUrl, {
        method: "POST"
    });

    console.log("Netlify Build Hook ausgelöst. Status:", status, "Response:", response.status);

    return {
        statusCode: 200,
        body: JSON.stringify({
            ok: true,
            skipped: false,
            reason: "Objekt ist öffentlich vermarktbar. Build wurde ausgelöst.",
            status,
            netlifyStatus: response.status
        })
    };
};
