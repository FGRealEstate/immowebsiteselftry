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

function isPlaceholder(label, input) {
    const clean = textValue(input);
    if (!clean) return true;

    const nLabel = normalizeText(label);
    const nValue = normalizeText(clean);

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
        "verfugbarab",
        "heizungsart",
        "energietrager"
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

function firstText(unit, fields) {
    for (const field of fields) {
        let candidate;

        if (field.startsWith("custom_fields.")) {
            candidate = customField(unit, field.replace("custom_fields.", ""));
        } else {
            candidate = unit[field];
        }

        const clean = textValue(candidate);
        if (clean) return clean;
    }

    return null;
}

function firstNumber(unit, fields) {
    for (const field of fields) {
        let candidate;

        if (field.startsWith("custom_fields.")) {
            candidate = customField(unit, field.replace("custom_fields.", ""));
        } else {
            candidate = unit[field];
        }

        const clean = numberValue(candidate);
        if (clean) return clean;
    }

    return null;
}

function addDetail(list, label, input) {
    const clean = textValue(input);
    if (!clean) return;
    if (isPlaceholder(label, clean)) return;

    list.push({ label, value: clean });
}

function addPriceDetail(list, label, input) {
    const clean = formatPrice(input);
    if (!clean) return;
    if (isPlaceholder(label, clean)) return;

    list.push({ label, value: clean });
}

function addAreaDetail(list, label, input) {
    const clean = formatNumber(input, " m²");
    if (!clean) return;
    if (isPlaceholder(label, clean)) return;

    list.push({ label, value: clean });
}

function addIntegerDetail(list, label, input, suffix = "") {
    const clean = formatInteger(input, suffix);
    if (!clean) return;
    if (isPlaceholder(label, clean)) return;

    list.push({ label, value: clean });
}

function addDateDetail(list, label, input) {
    const clean = formatDate(input);
    if (!clean) return;
    if (isPlaceholder(label, clean)) return;

    list.push({ label, value: clean });
}

function addDescription(list, label, input) {
    const clean = htmlValue(input);
    if (!clean) return;
    if (isPlaceholder(label, clean)) return;

    const duplicate = list.some((item) => normalizeText(item.value) === normalizeText(clean));
    if (duplicate) return;

    list.push({ label, value: clean });
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

    list.push({ label, value: clean });
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
        ...(Array.isArray(unit.media) ? unit.media : [])
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
    /*
     * Wichtig:
     * Der öffentliche Website-Titel soll NICHT aus internen Notizen kommen.
     * Propstack-Feldlogik:
     * 1. Überschrift / Headline / Titel
     * 2. Website-spezifische Titelfelder
     * 3. technische Fallbacks
     * Interne Notizen werden bewusst NICHT als Titel verwendet.
     */
    const candidates = [
        unit.headline,
        unit.title,
        unit.name,
        unit.label,

        customField(unit, "ueberschrift"),
        customField(unit, "überschrift"),
        customField(unit, "headline"),
        customField(unit, "titel"),
        customField(unit, "title"),
        customField(unit, "website_titel"),
        customField(unit, "objekt_titel_website"),
        customField(unit, "objekt_ueberschrift"),
        customField(unit, "objekt überschrift"),
        customField(unit, "objektüberschrift")
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

        if (normalized.includes("wohnung") || normalized.includes("wohnen")) {
            base = marketingType === "Miete" ? "Mietwohnung" : "Eigentumswohnung";
        } else if (normalized.includes("haus")) {
            base = "Haus";
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

    return location ? `${base} in ${location}` : base;
}

function getStatusName(unit) {
    return (
        textValue(unit.status) ||
        textValue(unit.property_status) ||
        textValue(unit.property_status_name) ||
        textValue(unit.status_name) ||
        textValue(unit.marketing_status) ||
        textValue(unit.custom_fields?.status) ||
        textValue(unit.custom_fields?.objekt_status) ||
        textValue(customField(unit, "objekt_status")) ||
        textValue(customField(unit, "objekt status")) ||
        null
    );
}

function isPublicMarketingObject(unit) {
    const statusName = getStatusName(unit);

    if (!statusName) {
        return false;
    }

    return normalizeText(statusName).includes("vermarktung");
}


function emptyPropstackData() {
    return {
        properties: [],
        units: [],
        projects: [],
        standaloneProperties: [],
        projectProperties: [],
        filters: {
            marketingTypes: [],
            propertyTypes: [],
            locations: [],
            projects: []
        },
        summary: {
            propertyCount: 0,
            projectCount: 0,
            projectUnitCount: 0,
            standaloneCount: 0
        }
    };
}

function arrayFromApiPayload(payload, preferredKeys = []) {
    if (Array.isArray(payload)) return payload;
    if (!payload || typeof payload !== "object") return [];

    for (const key of preferredKeys) {
        if (Array.isArray(payload[key])) return payload[key];
    }

    if (Array.isArray(payload.data)) return payload.data;
    if (Array.isArray(payload.items)) return payload.items;
    if (Array.isArray(payload.results)) return payload.results;

    return [];
}

async function fetchJson(url, apiKey, label) {
    try {
        const response = await fetch(url, {
            headers: {
                "X-API-KEY": apiKey,
                "Accept": "application/json"
            }
        });

        if (!response.ok) {
            const body = await response.text();
            console.warn(`${label} API Fehler:`, response.status, body.slice(0, 500));
            return null;
        }

        return await response.json();
    } catch (error) {
        console.warn(`${label} konnte nicht geladen werden:`, error.message);
        return null;
    }
}

function getProjectStatusName(project) {
    if (!project) return null;

    return (
        textValue(project.status) ||
        textValue(project.project_status) ||
        textValue(project.project_status_name) ||
        textValue(project.status_name) ||
        textValue(project.marketing_status) ||
        textValue(project.marketing_state) ||
        textValue(project.custom_fields?.status) ||
        textValue(project.custom_fields?.projekt_status) ||
        textValue(customField(project, "projekt_status")) ||
        textValue(customField(project, "projekt status")) ||
        null
    );
}

function isPublicMarketingProject(project) {
    const status = getProjectStatusName(project);
    if (!status) return false;
    return normalizeText(status).includes("vermarktung");
}

function getProjectReference(unit) {
    const nestedCandidates = [
        unit.project,
        unit.property_project,
        unit.development,
        unit.complex,
        unit.building,
        unit.parent_project
    ].filter(Boolean);

    for (const project of nestedCandidates) {
        if (!isPlainObject(project)) continue;

        const id = textValue(project.id) || textValue(project.uuid) || textValue(project.project_id);
        const name = textValue(project.name) || textValue(project.title) || textValue(project.project_name);
        const status = getProjectStatusName(project);

        if (id || name) return { id, name, status, raw: project };
    }

    const id = firstText(unit, [
        "project_id",
        "property_project_id",
        "development_id",
        "complex_id",
        "building_id",
        "parent_project_id",
        "custom_fields.projekt_id",
        "custom_fields.projektid",
        "custom_fields.project_id"
    ]) || textValue(customField(unit, "projekt_id")) || textValue(customField(unit, "project_id"));

    const name = firstText(unit, [
        "project_name",
        "property_project_name",
        "development_name",
        "complex_name",
        "building_name",
        "custom_fields.projekt",
        "custom_fields.projektname",
        "custom_fields.project_name"
    ]) || textValue(customField(unit, "projekt")) || textValue(customField(unit, "projektname"));

    return id || name ? { id, name, status: null, raw: null } : null;
}

function projectKey(project) {
    if (!project) return null;
    return textValue(project.id) || textValue(project.uuid) || normalizeText(textValue(project.name) || textValue(project.title));
}

function getProjectLocation(project, units = []) {
    const direct = firstText(project || {}, [
        "city",
        "location",
        "place",
        "address.city",
        "address.location",
        "custom_fields.projektort",
        "custom_fields.standort"
    ]);
    if (direct) return direct;

    for (const unit of units) {
        if (unit.location) return unit.location;
    }
    return null;
}

function getProjectImages(project, units = []) {
    const list = [];
    const seen = new Set();

    for (const image of getImages(project || {})) {
        if (!image?.url || seen.has(image.url)) continue;
        seen.add(image.url);
        list.push(image);
    }

    for (const unit of units) {
        for (const image of unit.images || []) {
            if (!image?.url || seen.has(image.url)) continue;
            seen.add(image.url);
            list.push(image);
        }
    }

    return list;
}

function buildUnit(unit) {
    const marketingType = translateMarketingType(unit.marketing_type);
    const propertyType = translateObjectType(
        unit.object_type || unit.rs_type || unit.rs_category || unit.category
    );

    const title = getPublicTitle(unit, marketingType, propertyType);
    const slug = slugify(`${title}-${unit.id}`);

    const priceRaw = firstNumber(unit, [
        "price", "purchase_price", "marketing_price", "sale_price", "custom_fields.kaufpreis"
    ]);
    const coldRentRaw = firstNumber(unit, [
        "cold_rent", "net_cold_rent", "rent_net", "base_rent", "custom_fields.kaltmiete"
    ]);
    const warmRentRaw = firstNumber(unit, [
        "warm_rent", "gross_rent", "rent_gross", "custom_fields.warmmiete"
    ]);
    const serviceChargesRaw = firstNumber(unit, [
        "service_charge", "service_charges", "additional_costs", "custom_fields.nebenkosten"
    ]);
    const heatingCostsRaw = firstNumber(unit, [
        "heating_costs", "custom_fields.heizkosten"
    ]);
    const depositRaw = firstNumber(unit, [
        "deposit", "rent_deposit", "custom_fields.kaution"
    ]);

    const livingSpaceRaw = firstNumber(unit, [
        "living_space", "property_space_value", "living_area", "custom_fields.wohnflaeche", "custom_fields.wohnfläche"
    ]);
    const usableAreaRaw = firstNumber(unit, ["usable_area", "usable_space", "custom_fields.nutzflaeche"]);
    const roomsRaw = firstNumber(unit, ["number_of_rooms", "rooms", "custom_fields.zimmer"]);
    const bedroomsRaw = firstNumber(unit, ["number_of_bed_rooms", "bedrooms"]);
    const bathroomsRaw = firstNumber(unit, ["number_of_bath_rooms", "bathrooms"]);
    const images = getImages(unit);

    const details = [];
    if (marketingType === "Miete") {
        addPriceDetail(details, "Kaltmiete", coldRentRaw);
        addPriceDetail(details, "Warmmiete", warmRentRaw);
        addPriceDetail(details, "Nebenkosten", serviceChargesRaw);
        addPriceDetail(details, "Heizkosten", heatingCostsRaw);
        addPriceDetail(details, "Kaution", depositRaw);
    } else {
        addPriceDetail(details, "Kaufpreis", priceRaw);
        if (numberValue(unit.price_per_sqm)) addPriceDetail(details, "Preis/qm", unit.price_per_sqm);
        else if (priceRaw && livingSpaceRaw) addPriceDetail(details, "Preis/qm", priceRaw / livingSpaceRaw);
    }

    addAreaDetail(details, "Wohnfläche", livingSpaceRaw);
    addAreaDetail(details, "Nutzfläche", usableAreaRaw);
    addAreaDetail(details, "Grundstücksfläche", unit.plot_area);
    addAreaDetail(details, "Balkon-/Terrassenfläche", unit.balcony_area);
    addAreaDetail(details, "Gartenfläche", unit.garden_area);
    addIntegerDetail(details, "Zimmer", roomsRaw);
    addIntegerDetail(details, "Schlafzimmer", bedroomsRaw);
    addIntegerDetail(details, "Badezimmer", bathroomsRaw);
    addDetail(details, "Objektart", propertyType);
    addDetail(details, "Vermarktung", marketingType);
    addDetail(details, "Objektzustand", unit.condition);
    addDateDetail(details, "Verfügbar ab", unit.available_from);
    addIntegerDetail(details, "Anzahl Parkplätze", unit.number_of_parking_spaces);
    addDetail(details, "Stellplatztyp", unit.parking_space_type);
    addDetail(details, "Etage", unit.floor);
    addDetail(details, "Baujahr", unit.construction_year || unit.year_built);
    addDetail(details, "Energieausweistyp", unit.energy_certificate_type);
    addDetail(details, "Energieeffizienzklasse", unit.energy_efficiency_class);
    addDetail(details, "Energieverbrauchswert", unit.energy_consumption);

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
    addBooleanFeature(features, "Keller", unit.cellar);
    addBooleanFeature(features, "Einbauküche", unit.built_in_kitchen);
    addBooleanFeature(features, "Balkon", unit.balcony);
    addBooleanFeature(features, "Terrasse", unit.terrace);
    addBooleanFeature(features, "Garten", unit.garden);
    addBooleanFeature(features, "Aufzug", unit.elevator);
    addBooleanFeature(features, "Gäste-WC", unit.guest_toilet);
    addBooleanFeature(features, "Abstellraum", unit.storage_room);
    addBooleanFeature(features, "Kamin", unit.fireplace);
    addBooleanFeature(features, "Sauna", unit.sauna);
    addBooleanFeature(features, "Barrierefrei", unit.barrier_free);
    addBooleanFeature(features, "Klimaanlage", unit.air_conditioning);
    addFeature(features, "Bad", unit.bathroom);
    addFeature(features, "Bodenbelag", unit.flooring);
    addFeature(features, "Ausstattung", unit.furnishing);
    addFeature(features, "Qualität der Ausstattung", unit.furnishing_quality);

    const projectRef = getProjectReference(unit);
    const displayPriceRaw = marketingType === "Miete" ? (coldRentRaw || warmRentRaw) : priceRaw;

    return {
        id: unit.id,
        slug,
        url: `/angebote/${slug}/`,
        title,
        unit_number: firstText(unit, ["unit_number", "external_id", "property_number", "custom_fields.einheitennummer"]),
        location: getPublicLocation(unit),
        marketing_type: marketingType,
        property_type: propertyType,
        status: getStatusName(unit),
        price_raw: displayPriceRaw,
        purchase_price_raw: priceRaw,
        price: marketingType === "Miete" ? formatPrice(coldRentRaw || warmRentRaw) : formatPrice(priceRaw),
        cold_rent_raw: coldRentRaw,
        cold_rent: formatPrice(coldRentRaw),
        warm_rent_raw: warmRentRaw,
        warm_rent: formatPrice(warmRentRaw),
        service_charges: formatPrice(serviceChargesRaw),
        heating_costs: formatPrice(heatingCostsRaw),
        deposit: formatPrice(depositRaw),
        price_per_sqm: numberValue(unit.price_per_sqm)
            ? formatPrice(unit.price_per_sqm)
            : priceRaw && livingSpaceRaw ? formatPrice(priceRaw / livingSpaceRaw) : null,
        living_space_raw: livingSpaceRaw,
        living_space: formatNumber(livingSpaceRaw, " m²"),
        usable_area_raw: usableAreaRaw,
        usable_area: formatNumber(usableAreaRaw, " m²"),
        rooms_raw: roomsRaw,
        rooms: formatInteger(roomsRaw),
        bedrooms_raw: bedroomsRaw,
        bedrooms: formatInteger(bedroomsRaw),
        bathrooms_raw: bathroomsRaw,
        bathrooms: formatInteger(bathroomsRaw),
        gallery: images.map((image) => image.url),
        images,
        main_image: images.length ? images[0].url : null,
        details,
        descriptions,
        features,
        project_ref: projectRef,
        project_id: projectRef?.id || null,
        project_name: projectRef?.name || null,
        request_url: `/objekt-anfragen.html?object_id=${unit.id}&object=${encodeURIComponent(title)}`,
        raw: unit
    };
}

function buildProject(project, units) {
    const id = textValue(project?.id) || textValue(project?.uuid) || units[0]?.project_id || slugify(textValue(project?.name) || units[0]?.project_name || "projekt");
    const name = textValue(project?.name) || textValue(project?.title) || textValue(project?.project_name) || units[0]?.project_name || `Immobilienprojekt ${id}`;
    const slug = slugify(`${name}-${id}`);
    const purchasePrices = units.map((unit) => unit.purchase_price_raw).filter(Boolean);
    const rents = units.map((unit) => unit.cold_rent_raw || unit.warm_rent_raw).filter(Boolean);
    const areas = units.map((unit) => unit.living_space_raw).filter(Boolean);
    const rooms = units.map((unit) => unit.rooms_raw).filter(Boolean);
    const images = getProjectImages(project, units);
    const isRental = units.length > 0 && units.every((unit) => unit.marketing_type === "Miete");
    const prices = isRental ? rents : purchasePrices;
    const minPriceRaw = prices.length ? Math.min(...prices) : null;
    const maxPriceRaw = prices.length ? Math.max(...prices) : null;
    const description = htmlValue(project?.description_long) || htmlValue(project?.description) || htmlValue(project?.description_note) || htmlValue(customField(project || {}, "projektbeschreibung"));

    return {
        id,
        name,
        title: name,
        slug,
        url: `/projekte/${slug}/`,
        status: getProjectStatusName(project),
        location: getProjectLocation(project, units),
        address: firstText(project || {}, ["address", "full_address", "street", "custom_fields.projektadresse"]),
        description,
        completion_date: formatDate(firstText(project || {}, ["completion_date", "planned_completion", "custom_fields.fertigstellung", "custom_fields.geplante_fertigstellung"])),
        construction_year: firstText(project || {}, ["construction_year", "year_built", "custom_fields.baujahr"]),
        total_units_declared: firstNumber(project || {}, ["number_of_units", "unit_count", "custom_fields.anzahl_einheiten"]),
        unit_count: units.length,
        available_unit_count: units.length,
        units,
        marketing_type: isRental ? "Miete" : "Kauf",
        min_price_raw: minPriceRaw,
        max_price_raw: maxPriceRaw,
        min_price: formatPrice(minPriceRaw),
        max_price: formatPrice(maxPriceRaw),
        price_range: minPriceRaw && maxPriceRaw
            ? (minPriceRaw === maxPriceRaw ? formatPrice(minPriceRaw) : `${formatPrice(minPriceRaw)} – ${formatPrice(maxPriceRaw)}`)
            : null,
        min_area: areas.length ? Math.min(...areas) : null,
        max_area: areas.length ? Math.max(...areas) : null,
        area_range: areas.length
            ? (Math.min(...areas) === Math.max(...areas)
                ? formatNumber(Math.min(...areas), " m²")
                : `${formatNumber(Math.min(...areas), " m²")} – ${formatNumber(Math.max(...areas), " m²")}`)
            : null,
        min_rooms: rooms.length ? Math.min(...rooms) : null,
        max_rooms: rooms.length ? Math.max(...rooms) : null,
        room_range: rooms.length
            ? (Math.min(...rooms) === Math.max(...rooms)
                ? formatNumber(Math.min(...rooms))
                : `${formatNumber(Math.min(...rooms))} – ${formatNumber(Math.max(...rooms))}`)
            : null,
        property_types: [...new Set(units.map((unit) => unit.property_type).filter(Boolean))],
        images,
        gallery: images.map((image) => image.url),
        main_image: images.length ? images[0].url : null,
        request_url: `/objekt-anfragen.html?project_id=${encodeURIComponent(id)}&object=${encodeURIComponent(name)}`,
        raw: project
    };
}

module.exports = async function () {
    const apiKey = process.env.PROPSTACK_API_KEY;
    const empty = emptyPropstackData();

    if (!apiKey) {
        console.warn("PROPSTACK_API_KEY fehlt.");
        return empty;
    }

    const unitUrl = process.env.PROPSTACK_API_URL || "https://api.propstack.de/v1/units?expand=1";
    const apiBase = process.env.PROPSTACK_API_BASE || "https://api.propstack.de/v1";
    const cleanBase = apiBase.replace(/\/$/, "");
    const projectUrls = process.env.PROPSTACK_PROJECTS_API_URL
        ? [process.env.PROPSTACK_PROJECTS_API_URL]
        : [
            `${cleanBase}/projects?expand=1`,
            `${cleanBase}/property_projects?expand=1`,
            `${cleanBase}/developments?expand=1`
        ];

    try {
        const unitPayload = await fetchJson(unitUrl, apiKey, "Propstack Einheiten");
        let projectPayload = null;
        let rawProjects = [];

        for (const candidateUrl of projectUrls) {
            projectPayload = await fetchJson(candidateUrl, apiKey, "Propstack Projekte");
            rawProjects = arrayFromApiPayload(projectPayload, ["projects", "property_projects", "developments"]);
            if (rawProjects.length) break;
        }

        const rawUnits = arrayFromApiPayload(unitPayload, ["units", "properties"]);

        const projectLookup = new Map();
        for (const project of rawProjects) {
            const key = projectKey(project);
            if (key) projectLookup.set(String(key), project);
            const nameKey = normalizeText(textValue(project.name) || textValue(project.title));
            if (nameKey) projectLookup.set(nameKey, project);
        }

        const publicProjects = rawProjects.filter((project) => project && project.archived !== true && isPublicMarketingProject(project));
        const publicProjectKeys = new Set();
        for (const project of publicProjects) {
            const key = projectKey(project);
            if (key) publicProjectKeys.add(String(key));
            const nameKey = normalizeText(textValue(project.name) || textValue(project.title));
            if (nameKey) publicProjectKeys.add(nameKey);
        }

        const standaloneProperties = [];
        const projectUnitsByKey = new Map();

        for (const rawUnit of rawUnits) {
            if (!rawUnit || rawUnit.archived === true || !isPublicMarketingObject(rawUnit)) continue;

            const unit = buildUnit(rawUnit);
            const ref = unit.project_ref;

            if (!ref) {
                standaloneProperties.push(unit);
                continue;
            }

            const idKey = ref.id ? String(ref.id) : null;
            const nameKey = ref.name ? normalizeText(ref.name) : null;
            const nestedProjectPublic = ref.raw ? isPublicMarketingProject(ref.raw) : false;
            const isProjectPublic = nestedProjectPublic || (idKey && publicProjectKeys.has(idKey)) || (nameKey && publicProjectKeys.has(nameKey));

            // Zentrale Freigabe: Eine Einheit eines Projekts erscheint nur,
            // wenn das Projekt selbst den Status "Vermarktung" hat.
            if (!isProjectPublic) continue;

            const groupingKey = idKey || nameKey;
            if (!groupingKey) continue;

            if (!projectUnitsByKey.has(groupingKey)) projectUnitsByKey.set(groupingKey, []);
            projectUnitsByKey.get(groupingKey).push(unit);
        }

        const projects = [];
        for (const [key, units] of projectUnitsByKey.entries()) {
            const project = projectLookup.get(key) || units[0]?.project_ref?.raw;
            if (!project || !isPublicMarketingProject(project)) continue;
            projects.push(buildProject(project, units));
        }

        projects.sort((a, b) => a.name.localeCompare(b.name, "de"));
        standaloneProperties.sort((a, b) => String(a.title).localeCompare(String(b.title), "de"));

        const projectProperties = projects.flatMap((project) => project.units.map((unit) => ({
            ...unit,
            project_id: project.id,
            project_name: project.name,
            project_url: project.url
        })));
        const properties = [...standaloneProperties, ...projectProperties];

        const marketingTypes = [...new Set(properties.map((property) => property.marketing_type).filter(Boolean))];
        const propertyTypes = [...new Set(properties.map((property) => property.property_type).filter(Boolean))];
        const locations = [...new Set(properties.map((property) => property.location).filter(Boolean))];

        console.log("PROPSTACK EINZELOBJEKTE:", standaloneProperties.length);
        console.log("PROPSTACK PROJEKTE (Status Vermarktung):", projects.length);
        console.log("PROPSTACK PROJEKTEINHEITEN:", projectProperties.length);

        return {
            properties,
            units: properties,
            projects,
            standaloneProperties,
            projectProperties,
            filters: {
                marketingTypes,
                propertyTypes,
                locations,
                projects: projects.map((project) => ({ id: project.id, name: project.name }))
            },
            summary: {
                propertyCount: properties.length,
                projectCount: projects.length,
                projectUnitCount: projectProperties.length,
                standaloneCount: standaloneProperties.length
            }
        };
    } catch (error) {
        console.warn("Propstack Fehler:", error.message);
        return empty;
    }
};
