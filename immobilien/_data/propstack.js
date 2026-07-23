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

module.exports = async function () {
    const apiKey = process.env.PROPSTACK_API_KEY;

    if (!apiKey) {
        console.warn("PROPSTACK_API_KEY fehlt.");

        return {
            properties: [],
            projects: [],
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

                    gallery: images.map((image) => image.url),
                    images,
                    main_image: images.length ? images[0].url : null,

                    details,
                    descriptions,
                    features,

                    project_id: textValue(unit.project_id) || textValue(unit.project?.id) || textValue(unit.project_uuid) || null,
                    project_name: textValue(unit.project_name) || textValue(unit.project?.name) || textValue(unit.project?.title) || textValue(unit.custom_fields?.projekt) || null,
                    unit_number: textValue(unit.unit_number) || textValue(unit.unit_no) || textValue(unit.custom_fields?.einheitennummer) || null,
                    request_url: `/objekt-anfragen.html?object_id=${unit.id}&object=${encodeURIComponent(title)}`
                };
            });

        const marketingTypes = [
            ...new Set(properties.map((property) => property.marketing_type).filter(Boolean))
        ];

        const propertyTypes = [
            ...new Set(properties.map((property) => property.property_type).filter(Boolean))
        ];

        const projectMap = new Map();
        properties.forEach((property) => {
            const key = property.project_id || (property.project_name ? slugify(property.project_name) : null);
            if (!key) return;
            if (!projectMap.has(key)) projectMap.set(key, { id:key, name:property.project_name || property.title, units:[], prices:[], locations:new Set(), main_image:property.main_image });
            const project = projectMap.get(key);
            project.units.push(property);
            if (property.price_raw) project.prices.push(property.price_raw);
            if (property.location) project.locations.add(property.location);
            if (!project.main_image && property.main_image) project.main_image = property.main_image;
        });
        const projects=[...projectMap.values()].filter(p=>p.units.length>1).map(p=>({
            ...p,
            slug:slugify(`${p.name}-${p.id}`),
            url:`/projekte/${slugify(`${p.name}-${p.id}`)}/`,
            unit_count:p.units.length,
            available_count:p.units.length,
            min_price_raw:p.prices.length?Math.min(...p.prices):null,
            max_price_raw:p.prices.length?Math.max(...p.prices):null,
            min_price:p.prices.length?formatPrice(Math.min(...p.prices)):null,
            max_price:p.prices.length?formatPrice(Math.max(...p.prices)):null,
            price_range:p.prices.length?(Math.min(...p.prices)===Math.max(...p.prices)?formatPrice(Math.min(...p.prices)):`${formatPrice(Math.min(...p.prices))} – ${formatPrice(Math.max(...p.prices))}`):'Kaufpreise auf Anfrage',
            location:[...p.locations][0]||null
        }));
        console.log("PROPSTACK OBJEKTE:", properties.length, "PROJEKTE:", projects.length);

        return {
            properties,
            projects,
            filters: {
                marketingTypes,
                propertyTypes
            }
        };

    } catch (error) {
        console.warn("Propstack Fehler:", error.message);

        return {
            properties: [],
            projects: [],
            filters: {
                marketingTypes: [],
                propertyTypes: []
            }
        };
    }
};
