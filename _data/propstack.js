function cleanValue(value) {
    if (value === null || value === undefined) return null;
    if (typeof value === "object") value = value.pretty_value || value.value || value.name || value.label || null;
    if (value === null || value === undefined) return null;

    const text = String(value).trim();
    if (!text || text === "0" || text === "-" || text.toLowerCase() === "null" || text.toLowerCase() === "undefined") return null;

    return value;
}

function toNumber(value) {
    if (value === null || value === undefined || value === "") return null;
    if (typeof value === "string") value = value.replace(/\./g, "").replace(",", ".").replace(/[^\d.-]/g, "");
    const number = Number(value);
    if (Number.isNaN(number) || number === 0) return null;
    return number;
}

function formatPrice(value) {
    const number = toNumber(value);
    if (!number) return null;
    return new Intl.NumberFormat("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(number) + " €";
}

function formatNumber(value, suffix = "") {
    const number = toNumber(value);
    if (!number) return null;
    return new Intl.NumberFormat("de-DE", { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(number) + suffix;
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

function addBoolean(list, label, value) {
    if (value === true || value === "true" || value === 1 || value === "1") {
        list.push({ label, value: "Ja" });
    }
}

function getImages(unit) {
    const images = unit.images || [];

    return images
        .map(img => ({
            url: img.big || img.original || img.medium || img.thumb || img.url || null,
            title: img.title || img.name || unit.title || unit.name || "Immobilie"
        }))
        .filter(img => img.url);
}

module.exports = async function () {
    const apiKey = process.env.PROPSTACK_API_KEY;

    if (!apiKey) {
        console.warn("PROPSTACK_API_KEY fehlt.");
        return { properties: [] };
    }

    try {
        const response = await fetch("https://api.propstack.de/v1/units?expand=1", {
            headers: {
                "X-API-KEY": apiKey,
                "Accept": "application/json"
            }
        });

        const raw = await response.json();
        const units = Array.isArray(raw) ? raw : [];

        const properties = units.map(unit => {
            const title =
                cleanValue(unit.title) ||
                cleanValue(unit.name) ||
                cleanValue(unit.address) ||
                "Immobilie";

            const priceRaw = cleanValue(unit.price);
            const images = getImages(unit);

            const details = [];

            addPrice(details, "Kaufpreis", unit.price);
            addPrice(details, "Preis/qm", unit.price_per_sqm);

            addArea(details, "Wohnfläche", unit.living_space || unit.property_space_value);
            addArea(details, "Grundstücksfläche", unit.plot_area);
            addArea(details, "Nutzfläche", unit.usable_area);

            addField(details, "Zimmer", unit.number_of_rooms);
            addField(details, "Schlafzimmer", unit.number_of_bed_rooms);
            addField(details, "Badezimmer", unit.number_of_bath_rooms);
            addField(details, "Etage", unit.floor);
            addField(details, "Etagenzahl", unit.number_of_floors);
            addField(details, "Etagenlage", unit.floor_position);

            addField(details, "Objektart", unit.object_type || unit.rs_type);
            addField(details, "Vermarktung", unit.marketing_type);
            addField(details, "Objektzustand", unit.condition);
            addField(details, "Verfügbar ab", unit.available_from);
            addField(details, "Letzte Modernisierung", unit.last_modernization);
            addField(details, "Qualität der Ausstattung", unit.furnishing_quality);
            addField(details, "Anzahl Parkplätze", unit.number_of_parking_spaces);
            addField(details, "Stellplatztyp", unit.parking_space_type);
            addField(details, "Baujahr", unit.construction_year || unit.building_year);

            addField(details, "Energieausweistyp", unit.energy_certificate_type);
            addField(details, "Energieeffizienzklasse", unit.energy_efficiency_class);
            addField(details, "Energieverbrauchswert", unit.energy_consumption);
            addField(details, "Heizungsart", unit.heating_type);
            addField(details, "Wesentlicher Energieträger", unit.main_energy_source);

            const features = [];

            addBoolean(features, "Aufzug", unit.elevator);
            addBoolean(features, "Keller", unit.cellar);
            addBoolean(features, "Einbauküche", unit.built_in_kitchen);
            addBoolean(features, "Balkon/Terrasse", unit.balcony);
            addBoolean(features, "Garten", unit.garden);
            addBoolean(features, "Kamin", unit.fireplace);
            addBoolean(features, "Sauna", unit.sauna);
            addBoolean(features, "Barrierefrei", unit.barrier_free);

            addField(features, "Bad", unit.bathroom);
            addField(features, "Bodenbelag", unit.flooring);

            const descriptions = [];

            addField(descriptions, "Objektbeschreibung", unit.description);
            addField(descriptions, "Lage", unit.location_description);
            addField(descriptions, "Ausstattung", unit.equipment_description);
            addField(descriptions, "Sonstiges", unit.other_information);

            const slug = slugify(`${title}-${unit.id}`);

            return {
                id: unit.id,
                slug,
                url: `/angebote/${slug}/`,
                title,

                city: cleanValue(unit.city),
                location: cleanValue(unit.city),

                marketing_type: cleanValue(unit.marketing_type),
                property_type: cleanValue(unit.object_type || unit.rs_type),

                price_raw: toNumber(priceRaw),
                price: formatPrice(priceRaw),

                living_space: formatNumber(unit.living_space || unit.property_space_value, " m²"),
                rooms: cleanValue(unit.number_of_rooms),
                construction_year: cleanValue(unit.construction_year || unit.building_year),

                images,
                gallery: images.map(img => img.url),
                main_image: images.length ? images[0].url : null,

                details,
                features,
                descriptions,

                request_url: `/objekt-anfragen.html?object_id=${unit.id}&object=${encodeURIComponent(title)}`
            };
        });

        console.log("PROPSTACK OBJEKTE:", properties.length);

        return { properties };

    } catch (error) {
        console.warn("Propstack Verbindung fehlgeschlagen:", error.message);
        return { properties: [] };
    }
};
