function value(v) {
    if (v === null || v === undefined) return null;

    if (typeof v === "object") {
        v = v.pretty_value ?? v.value ?? v.name ?? null;
    }

    if (v === null || v === undefined) return null;

    const text = String(v).trim();
    if (!text || text === "0" || text === "-" || text === "null" || text === "undefined") return null;

    return v;
}

function number(v) {
    v = value(v);
    if (!v) return null;

    if (typeof v === "string") {
        v = v.replace(/\./g, "").replace(",", ".").replace(/[^\d.-]/g, "");
    }

    const n = Number(v);
    return Number.isNaN(n) || n === 0 ? null : n;
}

function price(v) {
    const n = number(v);
    if (!n) return null;

    return new Intl.NumberFormat("de-DE", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(n) + " €";
}

function area(v) {
    const n = number(v);
    if (!n) return null;

    return new Intl.NumberFormat("de-DE", {
        maximumFractionDigits: 2
    }).format(n) + " m²";
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

function add(list, label, val) {
    const v = value(val);
    if (!v) return;
    list.push({ label, value: v });
}

function addPrice(list, label, val) {
    const v = price(val);
    if (v) list.push({ label, value: v });
}

function addArea(list, label, val) {
    const v = area(val);
    if (v) list.push({ label, value: v });
}

function getImages(unit) {
    return (unit.images || [])
        .map(img => ({
            url: img.big || img.original || img.medium || img.thumb || null,
            title: img.title || img.name || unit.name || "Immobilie"
        }))
        .filter(img => img.url);
}

module.exports = async function () {
    const apiKey = process.env.PROPSTACK_API_KEY;

    try {
        const response = await fetch("https://api.propstack.de/v1/units?expand=1", {
            headers: {
                "X-API-KEY": apiKey,
                "Accept": "application/json"
            }
        });

        const units = await response.json();

        const properties = units.map(unit => {
            const title =
                value(unit.name) ||
                value(unit.headline) ||
                value(unit.title) ||
                value(unit.address) ||
                "Immobilie";

            const images = getImages(unit);

            const details = [];

            addPrice(details, "Kaufpreis", unit.price);
            addPrice(details, "Preis/qm", unit.price_per_sqm);

            addArea(details, "Wohnfläche", unit.living_space || unit.property_space_value);
            addArea(details, "Grundstücksfläche", unit.plot_area);
            addArea(details, "Nutzfläche", unit.usable_area);

            add(details, "Zimmer", unit.number_of_rooms);
            add(details, "Schlafzimmer", unit.number_of_bed_rooms);
            add(details, "Badezimmer", unit.number_of_bath_rooms);
            add(details, "Etage", unit.floor);
            add(details, "Etagenzahl", unit.number_of_floors);
            add(details, "Objektart", unit.object_type || unit.rs_type);
            add(details, "Vermarktung", unit.marketing_type);
            add(details, "Objektzustand", unit.condition);
            add(details, "Verfügbar ab", unit.available_from);
            add(details, "Baujahr", unit.construction_year || unit.building_year);
            add(details, "Energieeffizienzklasse", unit.energy_efficiency_class);
            add(details, "Heizungsart", unit.heating_type);

            const descriptions = [];
            add(descriptions, "Objektbeschreibung", unit.description);
            add(descriptions, "Lage", unit.location_description);
            add(descriptions, "Ausstattung", unit.equipment_description);
            add(descriptions, "Sonstiges", unit.other_information);

            const features = [];
            add(features, "Bodenbelag", unit.flooring);
            add(features, "Bad", unit.bathroom);

            const slug = slugify(`${title}-${unit.id}`);

            return {
                id: unit.id,
                slug,
                url: `/angebote/${slug}/`,
                title,

                location: value(unit.city),

                marketing_type: value(unit.marketing_type),
                property_type: value(unit.object_type || unit.rs_type),

                price_raw: number(unit.price),
                price: price(unit.price),

                living_space: area(unit.living_space || unit.property_space_value),
                rooms: value(unit.number_of_rooms),
                construction_year: value(unit.construction_year || unit.building_year),

                gallery: images.map(img => img.url),
                main_image: images.length ? images[0].url : null,

                details,
                descriptions,
                features,

                request_url: `/objekt-anfragen.html?object_id=${unit.id}&object=${encodeURIComponent(title)}`
            };
        });

        console.log("PROPSTACK OBJEKTE:", properties.length);

        return { properties };

    } catch (error) {
        console.warn("Propstack Fehler:", error.message);
        return { properties: [] };
    }
};
