function isPlainObject(value) {
    return Object.prototype.toString.call(value) === "[object Object]";
}

function isEmpty(value) {
    if (value === null || value === undefined) return true;
    if (value === false) return true;

    if (typeof value === "number") {
        return value === 0 || Number.isNaN(value);
    }

    if (Array.isArray(value)) return value.length === 0;

    if (typeof value === "string") {
        const text = value.trim().toLowerCase();

        return (
            text === "" ||
            text === "0" ||
            text === "0.0" ||
            text === "0,0" ||
            text === "0.00" ||
            text === "0,00" ||
            text === "-" ||
            text === "null" ||
            text === "undefined" ||
            text === "keine angabe"
        );
    }

    return false;
}

function rawValue(value) {
    if (isEmpty(value)) return null;

    if (isPlainObject(value)) {
        return (
            rawValue(value.pretty_value) ||
            rawValue(value.value) ||
            rawValue(value.name) ||
            rawValue(value.label) ||
            null
        );
    }

    return value;
}

function textValue(value) {
    const valueRaw = rawValue(value);
    if (isEmpty(valueRaw)) return null;

    const text = String(valueRaw).trim();

    if (isEmpty(text)) return null;

    return text;
}

function numberValue(value) {
    let valueRaw = rawValue(value);
    if (isEmpty(valueRaw)) return null;

    if (typeof valueRaw === "string") {
        valueRaw = valueRaw
            .replace(/\s/g, "")
            .replace(/€/g, "")
            .replace(/m²/g, "")
            .replace(/\./g, "")
            .replace(",", ".")
            .replace(/[^\d.-]/g, "");
    }

    const number = Number(valueRaw);

    if (Number.isNaN(number) || number === 0) return null;

    return number;
}

function formatPrice(value) {
    const number = numberValue(value);
    if (!number) return null;

    return new Intl.NumberFormat("de-DE", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(number) + " €";
}

function formatNumber(value, suffix = "") {
    const number = numberValue(value);
    if (!number) return null;

    return new Intl.NumberFormat("de-DE", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2
    }).format(number) + suffix;
}

function formatInteger(value, suffix = "") {
    const number = numberValue(value);
    if (!number) return null;

    return new Intl.NumberFormat("de-DE", {
        maximumFractionDigits: 0
    }).format(number) + suffix;
}

function formatDate(value) {
    const clean = textValue(value);
    if (!clean) return null;

    const date = new Date(clean);
    if (Number.isNaN(date.getTime())) return clean;

    return new Intl.DateTimeFormat("de-DE", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric"
    }).format(date);
}

function slugify(value) {
    return String(value || "immobilie")
        .toLowerCase()
        .replace(/ä/g, "ae")
        .replace(/ö/g, "oe")
        .replace(/ü/g, "ue")
        .replace(/ß/g, "ss")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
}

function translateMarketingType(value) {
    const text = textValue(value);
    if (!text) return null;

    const map = {
        BUY: "Kauf",
        RENT: "Miete",
        LEASE: "Miete"
    };

    return map[text.toUpperCase()] || text;
}

function translateObjectType(value) {
    const text = textValue(value);
    if (!text) return null;

    const map = {
        LIVING: "Wohnen",
        APARTMENT: "Wohnung",
        HOUSE: "Haus",
        COMMERCIAL: "Gewerbe",
        PLOT: "Grundstück",
        LAND: "Grundstück"
    };

    return map[text.toUpperCase()] || text;
}

function addDetail(list, label, value) {
    const clean = textValue(value);
    if (!clean) return;

    if (clean.toLowerCase() === label.toLowerCase()) return;
    if (clean.toLowerCase() === `${label} ca.`.toLowerCase()) return;

    list.push({ label, value: clean });
}

function addPriceDetail(list, label, value) {
    const formatted = formatPrice(value);
    if (formatted) {
        list.push({ label, value: formatted });
    }
}

function addAreaDetail(list, label, value) {
    const formatted = formatNumber(value, " m²");
    if (formatted) {
        list.push({ label, value: formatted });
    }
}

function addIntegerDetail(list, label, value, suffix = "") {
    const formatted = formatInteger(value, suffix);
    if (formatted) {
        list.push({ label, value: formatted });
    }
}

function addDateDetail(list, label, value) {
    const formatted = formatDate(value);
    if (formatted) {
        list.push({ label, value: formatted });
    }
}

function addBooleanFeature(list, label, value) {
    if (value === true || value === "true" || value === 1 || value === "1") {
        list.push({ label, value: "Ja" });
    }
}

function addFeature(list, label, value) {
    const clean = textValue(value);
    if (!clean) return;

    if (clean.toLowerCase() === label.toLowerCase()) return;

    list.push({ label, value: clean });
}

function addDescription(list, label, value) {
    const clean = textValue(value);
    if (!clean) return;

    list.push({ label, value: clean });
}

function getImageUrl(image) {
    if (!image) return null;
    if (typeof image === "string") return image;

    return (
        image.big ||
        image.original ||
        image.medium ||
        image.thumb ||
        image.url ||
        image.file_url ||
        image.photo_url ||
        null
    );
}

function getImages(unit) {
    const allImages = [
        ...(unit.images || []),
        ...(unit.photos || []),
        ...(unit.pictures || []),
        ...(unit.media || [])
    ];

    const seen = new Set();

    return allImages
        .map((image) => {
            const url = getImageUrl(image);
            if (!url || seen.has(url)) return null;

            seen.add(url);

            return {
                url,
                title:
                    textValue(image.title) ||
                    textValue(image.name) ||
                    textValue(unit.name) ||
                    "Immobilie"
            };
        })
        .filter(Boolean);
}

function getTitle(unit) {
    return (
        textValue(unit.name) ||
        textValue(unit.headline?.value) ||
        textValue(unit.headline) ||
        textValue(unit.custom_fields?.ueberschrift) ||
        `Immobilie ${unit.id}`
    );
}

function getStreetFreeLocation(unit) {
    return (
        textValue(unit.city) ||
        textValue(unit.region) ||
        null
    );
}

module.exports = async function () {
    const apiKey = process.env.PROPSTACK_API_KEY;

    if (!apiKey) {
        console.warn("PROPSTACK_API_KEY fehlt.");

        return {
            properties: [],
            filters: {
                marketingTypes: [],
                propertyTypes: []
            }
        };
    }

    try {
        const response = await fetch("https://api.propstack.de/v1/units?expand=1", {
            headers: {
                "X-API-KEY": apiKey,
                "Accept": "application/json"
            }
        });

        if (!response.ok) {
            const errorText = await response.text();

            console.warn(
                "Propstack API Fehler:",
                response.status,
                errorText.slice(0, 500)
            );

            return {
                properties: [],
                filters: {
                    marketingTypes: [],
                    propertyTypes: []
                }
            };
        }

        const units = await response.json();

        if (!Array.isArray(units)) {
            console.warn("Propstack Antwort ist kein Array.");

            return {
                properties: [],
                filters: {
                    marketingTypes: [],
                    propertyTypes: []
                }
            };
        }

        const properties = units
            .filter((unit) => unit && unit.archived !== true)
            .map((unit) => {
                const title = getTitle(unit);
                const slug = slugify(`${title}-${unit.id}`);

                const marketingType = translateMarketingType(unit.marketing_type);
                const propertyType = translateObjectType(
                    unit.object_type ||
                    unit.rs_type ||
                    unit.rs_category
                );

                const priceRaw = numberValue(unit.price);
                const livingSpaceRaw = numberValue(
                    unit.living_space ||
                    unit.property_space_value
                );

                const images = getImages(unit);

                const details = [];

                addPriceDetail(details, "Kaufpreis", unit.price);
                addPriceDetail(details, "Preis/qm", unit.price_per_sqm);

                if (!unit.price_per_sqm && priceRaw && livingSpaceRaw) {
                    addPriceDetail(details, "Preis/qm", priceRaw / livingSpaceRaw);
                }

                addAreaDetail(details, "Wohnfläche", unit.living_space || unit.property_space_value);
                addAreaDetail(details, "Grundstücksfläche", unit.plot_area);
                addAreaDetail(details, "Nutzfläche", unit.usable_area);
                addAreaDetail(details, "Balkon-/Terrassenfläche", unit.balcony_area);
                addAreaDetail(details, "Gartenfläche", unit.garden_area);

                addIntegerDetail(details, "Zimmer", unit.number_of_rooms);
                addIntegerDetail(details, "Schlafzimmer", unit.number_of_bed_rooms);
                addIntegerDetail(details, "Badezimmer", unit.number_of_bath_rooms);

                addDetail(details, "Etage", unit.floor);
                addIntegerDetail(details, "Etagenzahl", unit.number_of_floors);
                addDetail(details, "Etagenlage", unit.floor_position);

                addDetail(details, "Objektart", propertyType);
                addDetail(details, "Vermarktung", marketingType);
                addDetail(details, "Objektzustand", unit.condition);
                addDateDetail(details, "Verfügbar ab", unit.available_from);
                addDetail(details, "Letzte Modernisierung", unit.last_modernization);
                addDetail(details, "Qualität der Ausstattung", unit.furnishing_quality);
                addIntegerDetail(details, "Anzahl Parkplätze", unit.number_of_parking_spaces);
                addDetail(details, "Stellplatztyp", unit.parking_space_type);

                addDetail(details, "Baujahr", unit.construction_year || unit.building_year);

                addDetail(details, "Energieausweistyp", unit.energy_certificate_type);
                addDateDetail(details, "Energieausweis gültig bis", unit.energy_certificate_valid_until);
                addDetail(details, "Energieeffizienzklasse", unit.energy_efficiency_class);
                addDetail(details, "Energieverbrauchswert", unit.energy_consumption);
                addDetail(details, "Energiekennwert Strom", unit.energy_electricity_value);
                addDetail(details, "Energiekennwert Wärme", unit.energy_heating_value);
                addDetail(details, "CO₂-Emissionen", unit.co2_emission);
                addDetail(details, "CO₂-Emissionsklasse", unit.co2_emission_class);
                addDetail(details, "Heizungsart", unit.heating_type);
                addDetail(details, "Wesentlicher Energieträger", unit.main_energy_source);

                addDetail(details, "Fußweg zu ÖPNV", unit.distance_to_public_transport);
                addDetail(details, "Fahrzeit nächste Autobahn", unit.distance_to_highway);
                addDetail(details, "Fahrzeit nächster HBF", unit.distance_to_main_station);
                addDetail(details, "Fahrzeit nächster Flughafen", unit.distance_to_airport);

                const descriptions = [];

                addDescription(descriptions, "Objektbeschreibung", unit.description);
                addDescription(descriptions, "Lage", unit.location_description);
                addDescription(descriptions, "Ausstattung", unit.equipment_description);
                addDescription(descriptions, "Sonstiges", unit.other_information);
                addDescription(descriptions, "Objektbeschreibung", unit.description_note);
                addDescription(descriptions, "Lage", unit.location_note);
                addDescription(descriptions, "Ausstattung", unit.furnishing_note);
                addDescription(descriptions, "Sonstiges", unit.other_note);

                const features = [];

                addBooleanFeature(features, "Aufzug", unit.elevator);
                addBooleanFeature(features, "Keller", unit.cellar);
                addBooleanFeature(features, "Einbauküche", unit.built_in_kitchen);
                addBooleanFeature(features, "Loggia", unit.loggia);
                addBooleanFeature(features, "Denkmalschutz", unit.monument);
                addBooleanFeature(features, "Abstellraum", unit.storage_room);
                addBooleanFeature(features, "Pool", unit.pool);
                addBooleanFeature(features, "Alarmanlage", unit.alarm_system);
                addBooleanFeature(features, "Klimaanlage", unit.air_conditioning);
                addBooleanFeature(features, "Barrierefrei", unit.barrier_free);
                addBooleanFeature(features, "Gäste-WC", unit.guest_toilet);
                addBooleanFeature(features, "Balkon/Terrasse", unit.balcony || unit.terrace);
                addBooleanFeature(features, "Garten", unit.garden);
                addBooleanFeature(features, "Als Ferienwohnung geeignet", unit.suitable_as_holiday_home);
                addBooleanFeature(features, "Kamin", unit.fireplace);
                addBooleanFeature(features, "Sauna", unit.sauna);
                addBooleanFeature(features, "Wintergarten", unit.winter_garden);

                addFeature(features, "Bad", unit.bathroom);
                addFeature(features, "Bodenbelag", unit.flooring);
                addFeature(features, "Ausstattung", unit.furnishing);
                addFeature(features, "Qualität der Ausstattung", unit.furnishing_quality);

                return {
                    id: unit.id,
                    slug,
                    url: `/angebote/${slug}/`,

                    title,
                    location: getStreetFreeLocation(unit),

                    marketing_type: marketingType,
                    property_type: propertyType,

                    price_raw: priceRaw,
                    price: formatPrice(unit.price),

                    price_per_sqm: unit.price_per_sqm
                        ? formatPrice(unit.price_per_sqm)
                        : priceRaw && livingSpaceRaw
                            ? formatPrice(priceRaw / livingSpaceRaw)
                            : null,

                    living_space_raw: livingSpaceRaw,
                    living_space: formatNumber(unit.living_space || unit.property_space_value, " m²"),

                    rooms_raw: numberValue(unit.number_of_rooms),
                    rooms: formatInteger(unit.number_of_rooms),

                    construction_year: textValue(unit.construction_year || unit.building_year),

                    gallery: images.map((image) => image.url),
                    images,
                    main_image: images.length ? images[0].url : null,

                    details,
                    descriptions,
                    features,

                    request_url: `/objekt-anfragen.html?object_id=${unit.id}&object=${encodeURIComponent(title)}`
                };
            });

        const marketingTypes = [
            ...new Set(properties.map((property) => property.marketing_type).filter(Boolean))
        ];

        const propertyTypes = [
            ...new Set(properties.map((property) => property.property_type).filter(Boolean))
        ];

        console.log("PROPSTACK OBJEKTE:", properties.length);

        return {
            properties,
            filters: {
                marketingTypes,
                propertyTypes
            }
        };

    } catch (error) {
        console.warn("Propstack Fehler:", error.message);

        return {
            properties: [],
            filters: {
                marketingTypes: [],
                propertyTypes: []
            }
        };
    }
};
