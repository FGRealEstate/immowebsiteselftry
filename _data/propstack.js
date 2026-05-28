function cleanValue(value) {
    if (value === null || value === undefined) return null;

    if (typeof value === "object") {
        value = value.name || value.label || value.value || value.pretty_value || null;
    }

    if (value === null || value === undefined) return null;

    const text = String(value).trim();

    if (!text || text === "0" || text === "-" || text.toLowerCase() === "null" || text.toLowerCase() === "undefined") {
        return null;
    }

    return value;
}

function toNumber(value) {
    if (value === null || value === undefined || value === "") return null;

    if (typeof value === "string") {
        value = value.replace(/\./g, "").replace(",", ".").replace(/[^\d.-]/g, "");
    }

    const number = Number(value);
    if (Number.isNaN(number) || number === 0) return null;

    return number;
}

function formatPrice(value) {
    const number = toNumber(value);
    if (!number) return null;

    return new Intl.NumberFormat("de-DE", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(number) + " €";
}

function formatNumber(value, suffix = "") {
    const number = toNumber(value);
    if (!number) return null;

    return new Intl.NumberFormat("de-DE", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2
    }).format(number) + suffix;
}

function slugify(text) {
    return String(text || "immobilie")
        .toLowerCase()
        .replace(/ä/g, "ae")
        .replace(/ö/g, "oe")
        .replace(/ü/g, "ue")
        .replace(/ß/g, "ss")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
}

function getImageUrl(image) {
    if (!image) return null;
    if (typeof image === "string") return image;

    return image.url || image.file_url || image.original_url || image.large_url || image.medium_url || image.preview_url || image.thumb_url || null;
}

function getImages(property) {
    const images = [
        ...(property.images || []),
        ...(property.pictures || []),
        ...(property.photos || []),
        ...(property.media || [])
    ];

    return images
        .map(img => ({
            url: getImageUrl(img),
            title: img.title || img.name || property.name || "Immobilie"
        }))
        .filter(img => img.url);
}

function addField(list, label, value) {
    const cleaned = cleanValue(value);
    if (!cleaned) return;

    const text = String(cleaned).trim();
    if (text.toLowerCase() === label.toLowerCase()) return;
    if (text.toLowerCase() === `${label} ca.`.toLowerCase()) return;

    list.push({ label, value: cleaned });
}

function addPrice(list, label, value) {
    const formatted = formatPrice(value);
    if (formatted) list.push({ label, value: formatted });
}

function addArea(list, label, value) {
    const formatted = formatNumber(value, " m²");
    if (formatted) list.push({ label, value: formatted });
}

async function fetchPropstack(url, apiKey) {
    const response = await fetch(url, {
        headers: {
            "X-API-KEY": apiKey,
            "Accept": "application/json"
        }
    });

    const text = await response.text();

    try {
        return JSON.parse(text);
    } catch {
        console.warn("Propstack Antwort war kein JSON:", text.slice(0, 300));
        return null;
    }
}

module.exports = async function () {
    const apiKey = process.env.PROPSTACK_API_KEY;
    const baseUrl = process.env.PROPSTACK_API_BASE || "https://crm.propstack.de/api/v1";

    if (!apiKey) {
        console.warn("PROPSTACK_API_KEY fehlt.");
        return { properties: [] };
    }

    try {
        let json = await fetchPropstack(`${baseUrl}/properties`, apiKey);

        let rawProperties =
            json?.data ||
            json?.properties ||
            json?.objects ||
            [];

        if (!Array.isArray(rawProperties) || rawProperties.length === 0) {
            json = await fetchPropstack(`${baseUrl}/objects`, apiKey);

            rawProperties =
                json?.data ||
                json?.properties ||
                json?.objects ||
                [];
        }

        if (!Array.isArray(rawProperties)) {
            rawProperties = [];
        }

        const properties = rawProperties.map(property => {
            const title =
                cleanValue(property.title) ||
                cleanValue(property.name) ||
                cleanValue(property.object_number) ||
                "Immobilie";

            const priceRaw =
                cleanValue(property.purchase_price) ||
                cleanValue(property.price) ||
                cleanValue(property.marketing_price?.value);

            const livingSpaceRaw =
                cleanValue(property.living_space) ||
                cleanValue(property.living_area);

            const images = getImages(property);

            const details = [];

            addPrice(details, "Kaufpreis", property.purchase_price || property.price);
            addPrice(details, "Preis/qm", property.price_per_sqm);

            addArea(details, "Wohnfläche", property.living_space || property.living_area);
            addArea(details, "Grundstücksfläche", property.plot_area || property.land_area);
            addArea(details, "Nutzfläche", property.usable_area);

            addField(details, "Zimmer", property.rooms || property.number_of_rooms);
            addField(details, "Schlafzimmer", property.bedrooms);
            addField(details, "Badezimmer", property.bathrooms);
            addField(details, "Etage", property.floor);
            addField(details, "Etagenzahl", property.floors || property.number_of_floors);
            addField(details, "Objektart", property.property_type || property.object_type || property.category);
            addField(details, "Vermarktung", property.marketing_type || property.rs_type || property.offer_type);
            addField(details, "Objektzustand", property.condition);
            addField(details, "Verfügbar ab", property.available_from);
            addField(details, "Baujahr", property.construction_year || property.building_year);
            addField(details, "Energieeffizienzklasse", property.energy_efficiency_class || property.energy_class);
            addField(details, "Heizungsart", property.heating_type);

            const features = [];
            addField(features, "Ausstattung", property.furnishing_description || property.equipment_description);
            addField(features, "Bodenbelag", property.flooring_type);
            addField(features, "Bad", property.bathroom_type);

            const descriptions = [];
            addField(descriptions, "Objektbeschreibung", property.description || property.public_description || property.long_description);
            addField(descriptions, "Lage", property.location_description);
            addField(descriptions, "Ausstattung", property.furnishing_description || property.equipment_description);
            addField(descriptions, "Sonstiges", property.other_description || property.other_information);

            const slug = slugify(`${title}-${property.id}`);

            return {
                id: property.id,
                slug,
                url: `/angebote/${slug}/`,
                title,

                city: cleanValue(property.city),
                location: cleanValue(property.city),

                marketing_type: cleanValue(property.marketing_type || property.rs_type || property.offer_type),
                property_type: cleanValue(property.property_type || property.object_type || property.category),

                price_raw: toNumber(priceRaw),
                price: formatPrice(priceRaw),

                living_space: formatNumber(livingSpaceRaw, " m²"),
                rooms: cleanValue(property.rooms || property.number_of_rooms),
                construction_year: cleanValue(property.construction_year || property.building_year),

                images,
                gallery: images.map(img => img.url),
                main_image: images.length ? images[0].url : null,

                details,
                features,
                descriptions,

                request_url: `/objekt-anfragen.html?object_id=${property.id}&object=${encodeURIComponent(title)}`
            };
        });

        console.log("PROPSTACK OBJEKTE:", properties.length);

        return { properties };

    } catch (error) {
        console.warn("Propstack Verbindung fehlgeschlagen:", error.message);
        return { properties: [] };
    }
};
