function formatPrice(value) {
    const number = toNumber(value);
    if (number === null) return null;

    return new Intl.NumberFormat("de-DE", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(number) + " €";
}

function formatNumber(value, suffix = "") {
    const number = toNumber(value);
    if (number === null) return null;

    return new Intl.NumberFormat("de-DE", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2
    }).format(number) + suffix;
}

function toNumber(value) {
    if (value === null || value === undefined || value === "") return null;

    if (typeof value === "string") {
        value = value.replace(/\./g, "").replace(",", ".").replace(/[^\d.-]/g, "");
    }

    const number = Number(value);

    if (Number.isNaN(number)) return null;
    if (number === 0) return null;

    return number;
}

function cleanValue(value) {
    if (value === null || value === undefined) return null;

    if (typeof value === "object") {
        value =
            value.name ||
            value.label ||
            value.value ||
            value.pretty_value ||
            value.formatted_value ||
            null;
    }

    if (value === null || value === undefined) return null;

    const text = String(value).trim();

    if (!text) return null;
    if (text === "0") return null;
    if (text === "-") return null;
    if (text.toLowerCase() === "null") return null;
    if (text.toLowerCase() === "undefined") return null;
    if (text.toLowerCase() === "keine angabe") return null;

    return value;
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

    return (
        image.url ||
        image.file_url ||
        image.original_url ||
        image.large_url ||
        image.medium_url ||
        image.small_url ||
        image.thumb_url ||
        image.download_url ||
        null
    );
}

function getImages(property) {
    const possibleImages = [
        ...(property.images || []),
        ...(property.pictures || []),
        ...(property.photos || []),
        ...(property.media || []),
        ...(property.documents || [])
    ];

    return possibleImages
        .filter(img => img && img.is_private !== true && img.private !== true)
        .map(img => ({
            url: getImageUrl(img),
            title: img.title || img.name || property.name || property.title || "Immobilie"
        }))
        .filter(img => img.url);
}

function addField(list, label, value) {
    const cleaned = cleanValue(value);

    if (!cleaned) return;

    const cleanedText = String(cleaned).trim();

    if (cleanedText.toLowerCase() === label.toLowerCase()) return;
    if (cleanedText.toLowerCase() === `${label} ca.`.toLowerCase()) return;

    list.push({
        label,
        value: cleaned
    });
}

function addPrice(list, label, value) {
    const formatted = formatPrice(value);
    if (formatted) list.push({ label, value: formatted });
}

function addArea(list, label, value) {
    const formatted = formatNumber(value, " m²");
    if (formatted) list.push({ label, value: formatted });
}

function addBoolean(list, label, value) {
    if (value === true || value === "true" || value === 1 || value === "1") {
        list.push({ label, value: "Ja" });
    }
}

module.exports = async function () {
    const apiKey = process.env.PROPSTACK_API_KEY;
    const baseUrl = process.env.PROPSTACK_API_BASE || "https://api.propstack.de/v1";

    if (!apiKey) {
        console.warn("PROPSTACK_API_KEY fehlt.");
        return { properties: [] };
    }

    try {
        const response = await fetch(`${baseUrl}/properties`, {
            headers: {
                "X-API-KEY": apiKey,
                "Accept": "application/json"
            }
        });

        if (!response.ok) {
            console.warn("Propstack API Fehler:", response.status, await response.text());
            return { properties: [] };
        }

        const json = await response.json();

        const rawProperties =
            json.data ||
            json.properties ||
            json.objects ||
            json.units ||
            json ||
            [];

        const properties = Array.isArray(rawProperties) ? rawProperties : [];

        const cleaned = properties.map(property => {
            const title =
                cleanValue(property.title) ||
                cleanValue(property.name) ||
                cleanValue(property.object_number) ||
                "Immobilie";

            const priceRaw =
                cleanValue(property.purchase_price) ||
                cleanValue(property.price) ||
                cleanValue(property.marketing_price?.value) ||
                cleanValue(property.marketing_price);

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
            addArea(details, "Balkon/Terrasse Fläche", property.balcony_area);
            addArea(details, "Gartenfläche", property.garden_area);

            addField(details, "Zimmer", property.rooms || property.number_of_rooms);
            addField(details, "Schlafzimmer", property.bedrooms);
            addField(details, "Badezimmer", property.bathrooms);
            addField(details, "Etage", property.floor);
            addField(details, "Etagenzahl", property.floors || property.number_of_floors);
            addField(details, "Etagenlage", property.floor_position);

            addField(details, "Objektart", property.property_type || property.object_type || property.category);
            addField(details, "Vermarktung", property.marketing_type || property.rs_type || property.offer_type);
            addField(details, "Objektzustand", property.condition);
            addField(details, "Verfügbar ab", property.available_from);
            addField(details, "Letzte Modernisierung", property.last_modernization);
            addField(details, "Qualität der Ausstattung", property.furnishing_quality);
            addField(details, "Anzahl Parkplätze", property.parking_space_count || property.number_of_parking_spaces);
            addField(details, "Stellplatztyp", property.parking_space_type);
            addField(details, "Baujahr", property.construction_year || property.building_year);

            addField(details, "Energieausweistyp", property.energy_certificate_type);
            addField(details, "Energieeffizienzklasse", property.energy_efficiency_class || property.energy_class);
            addField(details, "Energieverbrauchswert", property.energy_consumption);
            addField(details, "Heizungsart", property.heating_type);
            addField(details, "Wesentlicher Energieträger", property.main_energy_source);

            const features = [];

            addBoolean(features, "Aufzug", property.has_elevator);
            addBoolean(features, "Keller", property.has_cellar);
            addBoolean(features, "Einbauküche", property.has_built_in_kitchen);
            addBoolean(features, "Balkon/Terrasse", property.has_balcony);
            addBoolean(features, "Garten", property.has_garden);
            addBoolean(features, "Kamin", property.has_fireplace);
            addBoolean(features, "Sauna", property.has_sauna);
            addBoolean(features, "Barrierefrei", property.is_barrier_free);

            addField(features, "Bad", property.bathroom_type);
            addField(features, "Bodenbelag", property.flooring_type);

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
                location: cleanValue(property.city) || "Deutschland",

                marketing_type: cleanValue(property.marketing_type || property.rs_type || property.offer_type),
                property_type: cleanValue(property.property_type || property.object_type || property.category),

                price_raw: toNumber(priceRaw),
                price: formatPrice(priceRaw),
                price_per_sqm: property.price_per_sqm ? formatPrice(property.price_per_sqm) : null,

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

        return {
            properties: cleaned
        };

    } catch (error) {
        console.warn("Propstack Verbindung fehlgeschlagen:", error.message);
        return {
            properties: []
        };
    }
};
