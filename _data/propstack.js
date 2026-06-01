function isPlainObject(input) {
    return Object.prototype.toString.call(input) === "[object Object]";
}

function normalizeText(input) {
    return String(input || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/€/g, "euro")
        .replace(/²/g, "2")
        .replace(/[^a-z0-9]+/g, "")
        .trim();
}

function isEmpty(input) {
    if (input === null || input === undefined) return true;
    if (input === false) return true;

    if (typeof input === "number") {
        return Number.isNaN(input) || input === 0;
    }

    if (Array.isArray(input)) {
        return input.length === 0;
    }

    if (typeof input === "string") {
        const text = input.trim().toLowerCase();

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
            text === "keine angabe" ||
            text === "keine" ||
            text === "n/a"
        );
    }

    return false;
}

function rawValue(input) {
    if (isEmpty(input)) return null;

    if (isPlainObject(input)) {
        return (
            rawValue(input.pretty_value) ||
            rawValue(input.value) ||
            rawValue(input.name) ||
            rawValue(input.label) ||
            rawValue(input.title) ||
            null
        );
    }

    return input;
}

function textValue(input) {
    const raw = rawValue(input);
    if (isEmpty(raw)) return null;

    const text = String(raw).trim();
    if (isEmpty(text)) return null;

    return text;
}

function htmlValue(input) {
    const text = textValue(input);
    if (!text) return null;

    const cleaned = text
        .replace(/<p><br><\/p>/gi, "")
        .replace(/<p>\s*<\/p>/gi, "")
        .replace(/<br\s*\/?>/gi, "<br>")
        .trim();

    const withoutHtml = cleaned.replace(/<[^>]*>/g, "").trim();

    if (isEmpty(withoutHtml)) return null;

    return cleaned;
}

function numberValue(input) {
    let raw = rawValue(input);
    if (isEmpty(raw)) return null;

    if (typeof raw === "string") {
        raw = raw
            .replace(/\s/g, "")
            .replace(/€/g, "")
            .replace(/m²/g, "")
            .replace(/qm/g, "")
            .replace(/\./g, "")
            .replace(",", ".")
            .replace(/[^\d.-]/g, "");
    }

    const number = Number(raw);

    if (Number.isNaN(number) || number === 0) return null;

    return number;
}

function booleanValue(input) {
    if (input === true || input === 1) return true;
    if (input === false || input === 0 || input === null || input === undefined) return false;

    if (isPlainObject(input)) {
        return booleanValue(
            input.value ??
            input.pretty_value ??
            input.name ??
            input.label
        );
    }

    const text = String(input).trim().toLowerCase();

    return (
        text === "true" ||
        text === "1" ||
        text === "ja" ||
        text === "yes" ||
        text === "y" ||
        text === "vorhanden"
    );
}

function formatPrice(input) {
    const number = numberValue(input);
    if (!number) return null;

    return new Intl.NumberFormat("de-DE", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(number) + " €";
}

function formatPercent(input) {
    const number = numberValue(input);
    if (!number) return null;

    return new Intl.NumberFormat("de-DE", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2
    }).format(number) + " %";
}

function formatNumber(input, suffix = "") {
    const number = numberValue(input);
    if (!number) return null;

    return new Intl.NumberFormat("de-DE", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2
    }).format(number) + suffix;
}

function formatInteger(input, suffix = "") {
    const number = numberValue(input);
    if (!number) return null;

    return new Intl.NumberFormat("de-DE", {
        maximumFractionDigits: 0
    }).format(number) + suffix;
}

function formatDate(input) {
    const clean = textValue(input);
    if (!clean) return null;

    const date = new Date(clean);

    if (Number.isNaN(date.getTime())) {
        return clean;
    }

    return new Intl.DateTimeFormat("de-DE", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric"
    }).format(date);
}

function slugify(input) {
    return String(input || "immobilie")
        .toLowerCase()
        .replace(/ä/g, "ae")
        .replace(/ö/g, "oe")
        .replace(/ü/g, "ue")
        .replace(/ß/g, "ss")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
}

function translateMarketingType(input) {
    const text = textValue(input);
    if (!text) return null;

    const key = text.toUpperCase();

    const map = {
        BUY: "Kauf",
        SALE: "Kauf",
        PURCHASE: "Kauf",
        RENT: "Miete",
        LEASE: "Miete"
    };

    return map[key] || text;
}

function translateObjectType(input) {
    const text = textValue(input);
    if (!text) return null;

    const key = text.toUpperCase();

    const map = {
        LIVING: "Wohnen",
        APARTMENT: "Wohnung",
        FLAT: "Wohnung",
        HOUSE: "Haus",
        MULTI_FAMILY_HOUSE: "Mehrfamilienhaus",
        SINGLE_FAMILY_HOUSE: "Einfamilienhaus",
        COMMERCIAL: "Gewerbe",
        OFFICE: "Büro",
        STORE: "Ladenfläche",
        PLOT: "Grundstück",
        LAND: "Grundstück",
        GARAGE: "Garage",
        PARKING: "Stellplatz"
    };

    return map[key] || text;
}

function isPlaceholder(label, value) {
    const cleanValue = textValue(value);
    if (!cleanValue) return true;

    const nLabel = normalizeText(label);
    const nValue = normalizeText(cleanValue);

    if (!nValue) return true;
    if (nLabel && nValue === nLabel) return true;
    if (nLabel && nValue === nLabel + "ca") return true;

    const placeholders = [
        "beschreibung",
        "objektbeschreibung",
        "lage",
        "ausstattung",
        "sonstiges",
        "baujahr",
        "baujahrca",
        "erstellungsdatum",
        "co2emissionen",
        "co2emissionsklasse",
        "energieverbrauchswert",
        "energiekennwertstrom",
        "energiekennwertwarme",
        "bodenbelag",
        "objektzustand",
        "stellplatztyp",
        "etage",
        "etagenlage",
        "etagenzahl",
        "anzahlparkplatze",
        "verfugbarab"
    ];

    return placeholders.includes(nValue);
}

function isStreetLike(input, unit = {}) {
    const text = textValue(input);
    if (!text) return false;

    const lower = text.toLowerCase();

    const street = textValue(unit.street);
    const houseNumber = textValue(unit.house_number);
    const address = textValue(unit.address);
    const shortAddress = textValue(unit.short_address);

    if (street && lower.includes(street.toLowerCase())) return true;
    if (address && lower.includes(address.toLowerCase())) return true;
    if (shortAddress && lower.includes(shortAddress.toLowerCase())) return true;
    if (street && houseNumber && lower.includes(houseNumber.toLowerCase())) return true;

    return (
        /\b(strasse|straße|str\.|weg|allee|platz|damm|gasse|ufer|ring)\b/i.test(text) &&
        /\d/.test(text)
    );
}

function customField(unit, key) {
    if (!unit || !unit.custom_fields) return null;

    return (
        unit.custom_fields[key] ||
        unit.custom_fields[key.toLowerCase()] ||
        unit.custom_fields[key.toUpperCase()] ||
        null
    );
}

function firstValue(unit, fields) {
    for (const field of fields) {
        if (field.startsWith("custom_fields.")) {
            const key = field.replace("custom_fields.", "");
            const custom = customField(unit, key);
            const value = textValue(custom);
            if (value) return value;
        } else {
            const value = textValue(unit[field]);
            if (value) return value;
        }
    }

    return null;
}

function firstNumber(unit, fields) {
    for (const field of fields) {
        if (field.startsWith("custom_fields.")) {
            const key = field.replace("custom_fields.", "");
            const custom = customField(unit, key);
            const value = numberValue(custom);
            if (value) return value;
        } else {
            const value = numberValue(unit[field]);
            if (value) return value;
        }
    }

    return null;
}

function addDetail(list, label, input) {
    const clean = textValue(input);
    if (!clean) return;
    if (isPlaceholder(label, clean)) return;

    list.push({
        label,
        value: clean
    });
}

function addPriceDetail(list, label, input) {
    const clean = formatPrice(input);
    if (!clean) return;
    if (isPlaceholder(label, clean)) return;

    list.push({
        label,
        value: clean
    });
}

function addPercentDetail(list, label, input) {
    const clean = formatPercent(input);
    if (!clean) return;
    if (isPlaceholder(label, clean)) return;

    list.push({
        label,
        value: clean
    });
}

function addAreaDetail(list, label, input) {
    const clean = formatNumber(input, " m²");
    if (!clean) return;
    if (isPlaceholder(label, clean)) return;

    list.push({
        label,
        value: clean
    });
}

function addIntegerDetail(list, label, input, suffix = "") {
    const clean = formatInteger(input, suffix);
    if (!clean) return;
    if (isPlaceholder(label, clean)) return;

    list.push({
        label,
        value: clean
    });
}

function addDateDetail(list, label, input) {
    const clean = formatDate(input);
    if (!clean) return;
    if (isPlaceholder(label, clean)) return;

    list.push({
        label,
        value: clean
    });
}

function addDescription(list, label, input) {
    const clean = htmlValue(input);
    if (!clean) return;
    if (isPlaceholder(label, clean)) return;

    const duplicate = list.some((item) => normalizeText(item.value) === normalizeText(clean));
    if (duplicate) return;

    list.push({
        label,
        value: clean
    });
}

function addBooleanFeature(list, label, input) {
    if (!booleanValue(input)) return;

    list.push({
        label,
        value: "Ja"
    });
}

function addFeature(list, label, input) {
    const clean = textValue(input);
    if (!clean) return;
    if (isPlaceholder(label, clean)) return;

    list.push({
        label,
        value: clean
    });
}

function getImageUrl(image) {
    if (!image) return null;
    if (typeof image === "string") return image;

    return (
        image.big ||
        image.original ||
        image.large ||
        image.medium ||
        image.url ||
        image.file_url ||
        image.photo_url ||
        image.image_url ||
        image.download_url ||
        image.thumb ||
        null
    );
}

function getImages(unit) {
    const sources = [
        ...(Array.isArray(unit.images) ? unit.images : []),
        ...(Array.isArray(unit.photos) ? unit.photos : []),
        ...(Array.isArray(unit.pictures) ? unit.pictures : []),
        ...(Array.isArray(unit.media) ? unit.media : []),
        ...(Array.isArray(unit.documents) ? unit.documents : [])
    ];

    const seen = new Set();

    return sources
        .map((image) => {
            const url = getImageUrl(image);
            if (!url) return null;
            if (seen.has(url)) return null;

            seen.add(url);

            return {
                url,
                title:
                    textValue(image.title) ||
                    textValue(image.name) ||
                    "Immobilie"
            };
        })
        .filter(Boolean);
}

function getPublicLocation(unit) {
    return (
        textValue(unit.city) ||
        textValue(unit.region) ||
        textValue(unit.location_name) ||
        null
    );
}

function getPublicTitle(unit, marketingType, propertyType) {
    const candidates = [
        customField(unit, "ueberschrift"),
        customField(unit, "überschrift"),
        customField(unit, "headline"),
        unit.headline,
        unit.title,
        unit.label
    ];

    for (const candidate of candidates) {
        const clean = textValue(candidate);
        if (!clean) continue;
        if (isStreetLike(clean, unit)) continue;
        if (isPlaceholder("Titel", clean)) continue;

        return clean;
    }

    const location = getPublicLocation(unit);

    let base = "Immobilie";

    if (propertyType) {
        const normalized = normalizeText(propertyType);

        if (normalized.includes("wohnung")) {
            base = marketingType === "Miete" ? "Mietwohnung" : "Eigentumswohnung";
        } else if (normalized.includes("haus")) {
            base = "Haus";
        } else if (normalized.includes("mehrfamilienhaus")) {
            base = "Mehrfamilienhaus";
        } else if (normalized.includes("grundstuck")) {
            base = "Grundstück";
        } else if (normalized.includes("gewerbe")) {
            base = "Gewerbeimmobilie";
        } else if (normalized.includes("buro")) {
            base = "Bürofläche";
        } else {
            base = propertyType;
        }
    }

    if (location) {
        return `${base} in ${location}`;
    }

    return base;
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
        const apiUrl = process.env.PROPSTACK_API_URL || "https://api.propstack.de/v1/units?expand=1";

        const response = await fetch(apiUrl, {
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

        const apiData = await response.json();

        const units = Array.isArray(apiData)
            ? apiData
            : Array.isArray(apiData.data)
                ? apiData.data
                : Array.isArray(apiData.units)
                    ? apiData.units
                    : [];

        const properties = units
            .filter((unit) => unit && unit.archived !== true)
            .map((unit) => {
                const marketingType = translateMarketingType(unit.marketing_type);
                const propertyType = translateObjectType(
                    unit.object_type ||
                    unit.rs_type ||
                    unit.rs_category ||
                    unit.category
                );

                const title = getPublicTitle(unit, marketingType, propertyType);
                const slug = slugify(`${title}-${unit.id}`);

                const priceRaw = firstNumber(unit, [
                    "price",
                    "purchase_price",
                    "marketing_price",
                    "sale_price",
                    "custom_fields.kaufpreis"
                ]);

                const livingSpaceRaw = firstNumber(unit, [
                    "living_space",
                    "property_space_value",
                    "living_area",
                    "custom_fields.wohnflaeche",
                    "custom_fields.wohnfläche"
                ]);

                const roomsRaw = firstNumber(unit, [
                    "number_of_rooms",
                    "rooms",
                    "custom_fields.zimmer"
                ]);

                const constructionYear = firstValue(unit, [
                    "construction_year",
                    "building_year",
                    "year_built",
                    "custom_fields.baujahr"
                ]);

                const images = getImages(unit);

                const details = [];

                addPriceDetail(details, "Kaufpreis", priceRaw);
                addPriceDetail(details, "Kaltmiete", unit.base_rent);
                addPriceDetail(details, "Warmmiete", unit.total_rent);
                addPriceDetail(details, "Nebenkosten", unit.service_charges);
                addPriceDetail(details, "Heizkosten", unit.heating_costs);
                addPriceDetail(details, "Hausgeld/Monat", unit.house_money);
                addPriceDetail(details, "Stellplatzpreis", unit.parking_space_price);
                addPriceDetail(details, "Mieteinnahmen monatlich", unit.monthly_rental_income);
                addPriceDetail(details, "Mieteinnahmen jährlich", unit.annual_rental_income);

                if (numberValue(unit.price_per_sqm)) {
                    addPriceDetail(details, "Preis/qm", unit.price_per_sqm);
                } else if (priceRaw && livingSpaceRaw) {
                    addPriceDetail(details, "Preis/qm", priceRaw / livingSpaceRaw);
                }

                addPercentDetail(details, "Innenprovision", unit.internal_commission);
                addPercentDetail(details, "Außenprovision", unit.external_commission);
                addPriceDetail(details, "Gesamtprovision", unit.total_commission);
                addDetail(details, "Provision Hinweis", unit.commission_note);
                addDetail(details, "Außenprovision für Exposé", unit.courtage);

                addAreaDetail(details, "Wohnfläche", livingSpaceRaw);
                addAreaDetail(details, "Grundstücksfläche", unit.plot_area);
                addAreaDetail(details, "Nutzfläche", unit.usable_area);
                addAreaDetail(details, "Gewerbefläche", unit.commercial_area);
                addAreaDetail(details, "Lagerfläche", unit.storage_area);
                addAreaDetail(details, "Bürofläche", unit.office_area);
                addAreaDetail(details, "Verkaufsfläche", unit.retail_area);
                addAreaDetail(details, "Balkon-/Terrassenfläche", unit.balcony_area);
                addAreaDetail(details, "Gartenfläche", unit.garden_area);

                addIntegerDetail(details, "Zimmer", roomsRaw);
                addIntegerDetail(details, "Schlafzimmer", unit.number_of_bed_rooms);
                addIntegerDetail(details, "Badezimmer", unit.number_of_bath_rooms);
                addIntegerDetail(details, "Separate WCs", unit.number_of_sep_wc);
                addIntegerDetail(details, "Wohneinheiten", unit.number_of_units);
                addIntegerDetail(details, "Gewerbeeinheiten", unit.number_of_commercial_units);

                addDetail(details, "Etage", unit.floor);
                addIntegerDetail(details, "Etagenzahl", unit.number_of_floors);
                addDetail(details, "Etagenlage", unit.floor_position);

                addDetail(details, "Objektart", propertyType);
                addDetail(details, "Vermarktung", marketingType);
                addDetail(details, "Kategorie", unit.category);
                addDetail(details, "Unterkategorie", unit.subcategory);
                addDetail(details, "Objektzustand", unit.condition);
                addDetail(details, "Status", unit.status);
                addDateDetail(details, "Verfügbar ab", unit.available_from);
                addDetail(details, "Letzte Modernisierung", unit.last_modernization);
                addDetail(details, "Qualität der Ausstattung", unit.furnishing_quality);
                addIntegerDetail(details, "Anzahl Parkplätze", unit.number_of_parking_spaces);
                addDetail(details, "Stellplatztyp", unit.parking_space_type);
                addDetail(details, "Baujahr", constructionYear);

                addDetail(details, "Energieausweis", unit.energy_certificate);
                addDateDetail(details, "Energieausweis erstellt am", unit.energy_certificate_creation_date);
                addDateDetail(details, "Energieausweis ausgestellt am", unit.energy_certificate_date);
                addDateDetail(details, "Energieausweis gültig bis", unit.energy_certificate_valid_until);
                addDetail(details, "Energieausweistyp", unit.energy_certificate_type);
                addDetail(details, "Energieeffizienzklasse", unit.energy_efficiency_class);
                addDetail(details, "Energieverbrauchswert", unit.energy_consumption);
                addDetail(details, "Energiekennwert Strom", unit.energy_electricity_value);
                addDetail(details, "Energiekennwert Wärme", unit.energy_heating_value);
                addDetail(details, "CO₂-Emissionen", unit.co2_emission);
                addDetail(details, "CO₂-Emissionsklasse", unit.co2_emission_class);
                addDetail(details, "Heizungsart", unit.heating_type);
                addDetail(details, "Wesentlicher Energieträger", unit.main_energy_source);
                addDetail(details, "Baujahr Anlagentechnik", unit.energy_building_year);

                addDetail(details, "Fußweg zu ÖPNV", unit.distance_to_public_transport);
                addDetail(details, "Fahrzeit nächste Autobahn", unit.distance_to_highway);
                addDetail(details, "Fahrzeit nächster HBF", unit.distance_to_main_station);
                addDetail(details, "Fahrzeit nächster Flughafen", unit.distance_to_airport);

                const descriptions = [];

                addDescription(descriptions, "Objektbeschreibung", unit.description_note);
                addDescription(descriptions, "Objektbeschreibung", unit.description_long);
                addDescription(descriptions, "Objektbeschreibung", unit.long_description);
                addDescription(descriptions, "Objektbeschreibung", unit.description);

                addDescription(descriptions, "Lage", unit.location_note);
                addDescription(descriptions, "Lage", unit.location_description);
                addDescription(descriptions, "Lage", unit.location_long);

                addDescription(descriptions, "Ausstattung", unit.furnishing_note);
                addDescription(descriptions, "Ausstattung", unit.equipment_description);
                addDescription(descriptions, "Ausstattung", unit.furnishing_description);

                addDescription(descriptions, "Sonstiges", unit.other_note);
                addDescription(descriptions, "Sonstiges", unit.other_information);
                addDescription(descriptions, "Sonstiges", unit.miscellaneous);

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
                addBooleanFeature(features, "Balkon", unit.balcony);
                addBooleanFeature(features, "Terrasse", unit.terrace);
                addBooleanFeature(features, "Balkon/Terrasse", unit.balcony_or_terrace);
                addBooleanFeature(features, "Garten", unit.garden);
                addBooleanFeature(features, "Als Ferienwohnung geeignet", unit.suitable_as_holiday_home);
                addBooleanFeature(features, "Kamin", unit.fireplace);
                addBooleanFeature(features, "Sauna", unit.sauna);
                addBooleanFeature(features, "Wintergarten", unit.winter_garden);
                addBooleanFeature(features, "Vermietet", unit.rented);
                addBooleanFeature(features, "Denkmalgeschützt", unit.listed_building);
                addBooleanFeature(features, "Seniorengerecht", unit.senior_friendly);
                addBooleanFeature(features, "Rollstuhlgerecht", unit.wheelchair_accessible);

                addFeature(features, "Bad", unit.bathroom);
                addFeature(features, "Bodenbelag", unit.flooring);
                addFeature(features, "Ausstattung", unit.furnishing);
                addFeature(features, "Qualität der Ausstattung", unit.furnishing_quality);
                addFeature(features, "Küche", unit.kitchen);
                addFeature(features, "Heizung", unit.heating_type);
                addFeature(features, "Stellplatz", unit.parking_space_type);

                return {
                    id: unit.id,
                    slug,
                    url: `/angebote/${slug}/`,

                    title,
                    location: getPublicLocation(unit),

                    marketing_type: marketingType,
                    property_type: propertyType,

                    price_raw: priceRaw,
                    price: formatPrice(priceRaw),

                    price_per_sqm:
                        numberValue(unit.price_per_sqm)
                            ? formatPrice(unit.price_per_sqm)
                            : priceRaw && livingSpaceRaw
                                ? formatPrice(priceRaw / livingSpaceRaw)
                                : null,

                    living_space_raw: livingSpaceRaw,
                    living_space: formatNumber(livingSpaceRaw, " m²"),

                    rooms_raw: roomsRaw,
                    rooms: formatInteger(roomsRaw),

                    construction_year: isPlaceholder("Baujahr", constructionYear) ? null : constructionYear,

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
