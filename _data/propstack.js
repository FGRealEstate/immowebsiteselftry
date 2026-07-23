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


function valueAtPath(source, path) {
    if (!source || !path) return null;
    return path.split(".").reduce((current, key) => {
        if (current === null || current === undefined) return null;
        return current[key];
    }, source);
}

function firstNestedText(source, paths) {
    for (const path of paths) {
        const clean = textValue(valueAtPath(source, path));
        if (clean) return clean;
    }
    return null;
}

function firstNestedNumber(source, paths) {
    for (const path of paths) {
        const clean = numberValue(valueAtPath(source, path));
        if (clean) return clean;
    }
    return null;
}

function emptyPropstackResult() {
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

function extractProjectMetadata(unit) {
    const explicitId = firstNestedText(unit, [
        "project_id", "property_project_id", "development_id", "complex_id", "building_id",
        "project.id", "property_project.id", "development.id", "complex.id", "building.id",
        "custom_fields.projekt_id", "custom_fields.projektid", "custom_fields.project_id"
    ]);

    const explicitName = firstNestedText(unit, [
        "project_name", "property_project_name", "development_name", "complex_name", "building_name",
        "project.name", "project.title", "property_project.name", "property_project.title",
        "development.name", "development.title", "complex.name", "complex.title", "building.name",
        "custom_fields.projekt", "custom_fields.projektname", "custom_fields.project_name"
    ]);

    const projectObject = unit.project || unit.property_project || unit.development || unit.complex || null;
    const hasExplicitProject = Boolean(explicitId || explicitName || projectObject);

    if (!hasExplicitProject) {
        return {
            hasProject: false,
            id: null,
            name: null,
            slug: null,
            description: null,
            location: null,
            address: null,
            completionDate: null,
            constructionYear: null,
            status: null,
            totalUnits: null,
            images: []
        };
    }

    const name = explicitName || `Immobilienprojekt ${explicitId}`;
    const id = explicitId || slugify(name);
    const description = firstNestedText(unit, [
        "project.description", "project.description_long", "property_project.description",
        "development.description", "complex.description", "custom_fields.projektbeschreibung"
    ]);
    const location = firstNestedText(unit, [
        "project.city", "project.location", "property_project.city", "development.city",
        "complex.city", "custom_fields.projektort"
    ]) || getPublicLocation(unit);
    const address = firstNestedText(unit, [
        "project.address", "project.short_address", "property_project.address",
        "development.address", "complex.address", "custom_fields.projektadresse"
    ]);
    const completionDate = firstNestedText(unit, [
        "project.completion_date", "project.expected_completion", "development.completion_date",
        "custom_fields.fertigstellung", "custom_fields.geplante_fertigstellung"
    ]);
    const constructionYear = firstNestedNumber(unit, [
        "project.construction_year", "project.year_built", "development.construction_year",
        "custom_fields.projekt_baujahr"
    ]);
    const status = firstNestedText(unit, [
        "project.status", "property_project.status", "development.status",
        "custom_fields.projektstatus"
    ]);
    const totalUnits = firstNestedNumber(unit, [
        "project.total_units", "project.unit_count", "property_project.total_units",
        "development.total_units", "custom_fields.anzahl_einheiten"
    ]);

    let images = [];
    if (projectObject) {
        images = getImages(projectObject);
    }

    return {
        hasProject: true,
        id: String(id),
        name,
        slug: slugify(name || id),
        description,
        location,
        address,
        completionDate,
        constructionYear,
        status,
        totalUnits,
        images
    };
}

function rangeLabel(values, formatter, fallback = null) {
    const clean = values.filter((value) => typeof value === "number" && Number.isFinite(value) && value > 0);
    if (!clean.length) return fallback;
    const min = Math.min(...clean);
    const max = Math.max(...clean);
    if (min === max) return formatter(min);
    return `${formatter(min)} – ${formatter(max)}`;
}

function buildProjects(properties) {
    const groups = new Map();

    for (const property of properties) {
        if (!property.project || !property.project.hasProject) continue;

        const projectKey = property.project.id || property.project.slug || property.project.name;
        if (!projectKey) continue;

        if (!groups.has(projectKey)) {
            groups.set(projectKey, {
                id: String(projectKey),
                name: property.project.name || "Immobilienprojekt",
                slug: property.project.slug || slugify(property.project.name || projectKey),
                description: property.project.description,
                location: property.project.location || property.location,
                address: property.project.address,
                completion_date: formatDate(property.project.completionDate),
                construction_year: property.project.constructionYear,
                status: property.project.status,
                declared_total_units: property.project.totalUnits,
                project_images: property.project.images || [],
                units: []
            });
        }

        const group = groups.get(projectKey);
        group.units.push(property);

        if (!group.description && property.project.description) group.description = property.project.description;
        if (!group.location && property.location) group.location = property.location;
        if (!group.main_image && property.main_image) group.main_image = property.main_image;
    }

    return [...groups.values()]
        .map((project) => {
            const units = project.units.sort((a, b) => {
                const aNumber = String(a.unit_number || a.title || "");
                const bNumber = String(b.unit_number || b.title || "");
                return aNumber.localeCompare(bNumber, "de", { numeric: true });
            });

            const prices = units.map((unit) => unit.price_raw).filter(Boolean);
            const spaces = units.map((unit) => unit.living_space_raw).filter(Boolean);
            const rooms = units.map((unit) => unit.rooms_raw).filter(Boolean);
            const propertyTypes = [...new Set(units.map((unit) => unit.property_type).filter(Boolean))];
            const marketingTypes = [...new Set(units.map((unit) => unit.marketing_type).filter(Boolean))];
            const images = [];
            const seenImages = new Set();

            for (const image of [...project.project_images, ...units.flatMap((unit) => unit.images || [])]) {
                if (!image || !image.url || seenImages.has(image.url)) continue;
                seenImages.add(image.url);
                images.push(image);
            }

            const availableUnits = units.filter((unit) => unit.is_available !== false);
            const minPrice = prices.length ? Math.min(...prices) : null;
            const maxPrice = prices.length ? Math.max(...prices) : null;

            return {
                ...project,
                url: `/projekte/${project.slug}/`,
                units,
                unit_count: units.length,
                available_count: availableUnits.length,
                total_units: project.declared_total_units || units.length,
                min_price_raw: minPrice,
                max_price_raw: maxPrice,
                min_price: formatPrice(minPrice),
                max_price: formatPrice(maxPrice),
                price_range: rangeLabel(prices, formatPrice, "Kaufpreise auf Anfrage"),
                living_space_range: rangeLabel(spaces, (value) => formatNumber(value, " m²")),
                rooms_range: rangeLabel(rooms, (value) => formatNumber(value, " Zimmer")),
                property_types: propertyTypes,
                marketing_types: marketingTypes,
                images,
                gallery: images.map((image) => image.url),
                main_image: project.main_image || (images[0] ? images[0].url : null),
                request_url: `/objekt-anfragen.html?project=${encodeURIComponent(project.name)}`
            };
        })
        .sort((a, b) => a.name.localeCompare(b.name, "de"));
}

module.exports = async function () {
    const apiKey = process.env.PROPSTACK_API_KEY;

    if (!apiKey) {
        console.warn("PROPSTACK_API_KEY fehlt.");

        return emptyPropstackResult();
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
            .filter((unit) => unit && unit.archived !== true && isPublicMarketingObject(unit))
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

                const coldRentRaw = firstNumber(unit, [
                    "cold_rent", "net_cold_rent", "base_rent", "net_rent", "rent",
                    "monthly_rent", "asking_rent", "custom_fields.kaltmiete", "custom_fields.nettokaltmiete"
                ]);
                const warmRentRaw = firstNumber(unit, [
                    "warm_rent", "gross_rent", "total_rent", "rent_total",
                    "custom_fields.warmmiete", "custom_fields.gesamtmiete"
                ]);
                const serviceChargeRaw = firstNumber(unit, [
                    "service_charge", "additional_costs", "utilities_costs", "operating_costs",
                    "custom_fields.nebenkosten", "custom_fields.betriebskosten"
                ]);
                const heatingCostsRaw = firstNumber(unit, [
                    "heating_costs", "heating_cost", "custom_fields.heizkosten"
                ]);
                const depositRaw = firstNumber(unit, [
                    "deposit", "security_deposit", "rental_deposit", "custom_fields.kaution"
                ]);
                const parkingRentRaw = firstNumber(unit, [
                    "parking_space_rent", "parking_rent", "garage_rent", "custom_fields.stellplatzmiete"
                ]);
                const isRental = normalizeText(marketingType).includes("miete") || normalizeText(unit.marketing_type).includes("rent");
                const displayPriceRaw = isRental ? (coldRentRaw || warmRentRaw || priceRaw) : priceRaw;

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

                const bedroomsRaw = firstNumber(unit, [
                    "number_of_bed_rooms",
                    "bedrooms"
                ]);

                const bathroomsRaw = firstNumber(unit, [
                    "number_of_bath_rooms",
                    "bathrooms"
                ]);

                const images = getImages(unit);

                const details = [];

                if (isRental) {
                    addPriceDetail(details, "Nettokaltmiete", coldRentRaw);
                    addPriceDetail(details, "Warmmiete", warmRentRaw);
                    addPriceDetail(details, "Nebenkosten", serviceChargeRaw);
                    addPriceDetail(details, "Heizkosten", heatingCostsRaw);
                    addPriceDetail(details, "Kaution", depositRaw);
                    addPriceDetail(details, "Stellplatzmiete", parkingRentRaw);
                } else {
                    addPriceDetail(details, "Kaufpreis", priceRaw);
                }

                if (!isRental && numberValue(unit.price_per_sqm)) {
                    addPriceDetail(details, "Preis/qm", unit.price_per_sqm);
                } else if (!isRental && priceRaw && livingSpaceRaw) {
                    addPriceDetail(details, "Preis/qm", priceRaw / livingSpaceRaw);
                }

                addAreaDetail(details, "Wohnfläche", livingSpaceRaw);
                addAreaDetail(details, "Grundstücksfläche", unit.plot_area);
                addAreaDetail(details, "Nutzfläche", unit.usable_area);
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

                const project = extractProjectMetadata(unit);
                const unitNumber = firstText(unit, [
                    "unit_number", "unit_no", "number", "internal_number",
                    "custom_fields.einheitennummer", "custom_fields.wohnungsnummer", "custom_fields.we_nummer"
                ]);
                const availabilityStatus = firstText(unit, [
                    "availability_status", "sales_status", "marketing_status", "status",
                    "custom_fields.verfuegbarkeit", "custom_fields.verfügbarkeit"
                ]);
                const normalizedAvailability = normalizeText(availabilityStatus);
                const isAvailable = !["verkauft", "reserviert", "vermietet", "zuruckgezogen", "archiviert"]
                    .some((status) => normalizedAvailability.includes(status));

                return {
                    id: unit.id,
                    slug,
                    url: `/angebote/${slug}/`,

                    title,
                    location: getPublicLocation(unit),

                    marketing_type: marketingType,
                    property_type: propertyType,

                    price_raw: displayPriceRaw,
                    price: formatPrice(displayPriceRaw),
                    price_label: isRental ? (coldRentRaw ? "Nettokaltmiete / Monat" : "Warmmiete / Monat") : "Kaufpreis",
                    is_rental: isRental,
                    cold_rent_raw: coldRentRaw,
                    cold_rent: formatPrice(coldRentRaw),
                    warm_rent_raw: warmRentRaw,
                    warm_rent: formatPrice(warmRentRaw),
                    service_charge: formatPrice(serviceChargeRaw),
                    heating_costs: formatPrice(heatingCostsRaw),
                    deposit: formatPrice(depositRaw),
                    parking_rent: formatPrice(parkingRentRaw),

                    price_per_sqm:
                        !isRental && numberValue(unit.price_per_sqm)
                            ? formatPrice(unit.price_per_sqm)
                            : !isRental && priceRaw && livingSpaceRaw
                                ? formatPrice(priceRaw / livingSpaceRaw)
                                : null,

                    living_space_raw: livingSpaceRaw,
                    living_space: formatNumber(livingSpaceRaw, " m²"),
                    usable_space_raw: numberValue(unit.usable_area),
                    usable_space: formatNumber(unit.usable_area, " m²"),

                    rooms_raw: roomsRaw,
                    rooms: formatInteger(roomsRaw),

                    bedrooms_raw: bedroomsRaw,
                    bedrooms: formatInteger(bedroomsRaw),

                    bathrooms_raw: bathroomsRaw,
                    bathrooms: formatInteger(bathroomsRaw),
                    floor: textValue(unit.floor),

                    gallery: images.map((image) => image.url),
                    images,
                    main_image: images.length ? images[0].url : null,

                    details,
                    descriptions,
                    features,

                    unit_number: unitNumber,
                    availability_status: availabilityStatus,
                    is_available: isAvailable,
                    project,
                    project_id: project.id,
                    project_name: project.name,
                    project_slug: project.slug,
                    project_url: project.hasProject ? `/projekte/${project.slug}/` : null,

                    request_url: `/objekt-anfragen.html?object_id=${unit.id}&object=${encodeURIComponent(title)}${project.hasProject ? `&project=${encodeURIComponent(project.name)}` : ""}`
                };
            });

        const marketingTypes = [
            ...new Set(properties.map((property) => property.marketing_type).filter(Boolean))
        ];

        const propertyTypes = [
            ...new Set(properties.map((property) => property.property_type).filter(Boolean))
        ];

        const projects = buildProjects(properties);
        const projectPropertyIds = new Set(projects.flatMap((project) => project.units.map((unit) => String(unit.id))));
        const projectProperties = properties.filter((property) => projectPropertyIds.has(String(property.id)));
        const standaloneProperties = properties.filter((property) => !projectPropertyIds.has(String(property.id)));
        const locations = [...new Set(properties.map((property) => property.location).filter(Boolean))].sort((a, b) => a.localeCompare(b, "de"));

        console.log("PROPSTACK OBJEKTE:", properties.length);
        console.log("PROPSTACK PROJEKTE:", projects.length);
        console.log("PROPSTACK EINZELOBJEKTE:", standaloneProperties.length);

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
                projects: projects.map((project) => ({
                    id: project.id,
                    name: project.name,
                    slug: project.slug,
                    unit_count: project.unit_count
                }))
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

        return emptyPropstackResult();
    }
};
