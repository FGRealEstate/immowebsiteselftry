module.exports = async function () {
  const apiKey = process.env.PROPSTACK_API_KEY;

  if (!apiKey) {
    console.warn("PROPSTACK_API_KEY fehlt.");
    return { properties: [] };
  }

  function clean(value) {
    if (value === null || value === undefined || value === "") return "";

    if (typeof value === "object") {
      return (
        value.pretty_value ||
        value.formatted_value ||
        value.value ||
        value.name ||
        value.label ||
        ""
      );
    }

    return value;
  }

  function hasValue(value) {
    return value !== null && value !== undefined && value !== "";
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

  function formatNumber(value, decimals = 2) {
    if (!hasValue(value)) return "";

    let number = value;

    if (typeof value === "object") {
      number = value.value || value.pretty_value || value.formatted_value;
    }

    if (typeof number === "string") {
      number = number
        .replace(/\./g, "")
        .replace(",", ".")
        .replace(/[^\d.-]/g, "");
    }

    number = Number(number);

    if (Number.isNaN(number)) return "";

    return number.toLocaleString("de-DE", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    });
  }

  function formatMoney(value) {
    const formatted = formatNumber(value, 2);
    return formatted ? `${formatted} €` : "";
  }

  function formatArea(value) {
    const formatted = formatNumber(value, 0);
    return formatted ? `${formatted} m²` : "";
  }

  function formatInteger(value) {
    const formatted = formatNumber(value, 0);
    return formatted || "";
  }

  function pushIfValue(list, label, value, suffix = "") {
    const cleaned = clean(value);

    if (hasValue(cleaned)) {
      list.push({
        label,
        value: suffix ? `${cleaned} ${suffix}` : cleaned
      });
    }
  }

  function pushMoneyIfValue(list, label, value) {
    const formatted = formatMoney(value);

    if (formatted) {
      list.push({
        label,
        value: formatted
      });
    }
  }

  function pushAreaIfValue(list, label, value) {
    const formatted = formatArea(value);

    if (formatted) {
      list.push({
        label,
        value: formatted
      });
    }
  }

  function pushBoolIfTrue(list, label, value) {
    if (value === true || value === "true" || value === 1 || value === "1") {
      list.push({
        label,
        value: "Ja"
      });
    }
  }

  function firstImage(property) {
    return (
      property.title_picture_url ||
      property.cover_picture_url ||
      property.image_url ||
      property.title_picture?.url ||
      property.cover_picture?.url ||
      property.images?.[0]?.url ||
      property.pictures?.[0]?.url ||
      "/images/placeholder.jpg"
    );
  }

  function galleryImages(property) {
    const images = property.images || property.pictures || [];

    return images
      .map((image) => {
        if (typeof image === "string") return image;
        return image.url || image.src || image.original_url || "";
      })
      .filter(Boolean);
  }

  try {
    const response = await fetch(
      "https://api.propstack.de/v1/units?with_meta=1&expand=1&archived=-1",
      {
        headers: {
          "X-API-KEY": apiKey,
          "Accept": "application/json"
        }
      }
    );

    if (!response.ok) {
      console.warn("Propstack API Fehler:", response.status, await response.text());
      return { properties: [] };
    }

    const data = await response.json();
    const rawProperties = data.data || [];

    const properties = rawProperties.map((property) => {
      const title = property.name || property.title || property.heading || "Immobilie";
      const slug = slugify(`${title}-${property.id}`);

      const price =
        formatMoney(property.purchase_price) ||
        formatMoney(property.price) ||
        formatMoney(property.cold_rent) ||
        formatMoney(property.warm_rent) ||
        "";

      const livingSpace =
        formatArea(property.living_space) ||
        formatArea(property.surface) ||
        formatArea(property.area) ||
        "";

      const rooms =
        formatInteger(property.number_of_rooms) ||
        formatInteger(property.rooms) ||
        "";

      const constructionYear =
        clean(property.construction_year) ||
        clean(property.building_year) ||
        "";

      const marketingType =
        clean(property.marketing_type) ||
        clean(property.rs_type) ||
        clean(property.offer_type) ||
        "";

      const propertyType =
        clean(property.property_type) ||
        clean(property.object_type) ||
        clean(property.category) ||
        "";

      const shortLocation =
        clean(property.city) ||
        clean(property.region) ||
        "Deutschland";

      const details = [];

      pushMoneyIfValue(details, "Kaufpreis", property.purchase_price);
      pushMoneyIfValue(details, "Preis/qm", property.price_per_sqm);
      pushMoneyIfValue(details, "Kaltmiete", property.cold_rent);
      pushMoneyIfValue(details, "Warmmiete", property.warm_rent);
      pushMoneyIfValue(details, "Nebenkosten", property.service_charges);
      pushMoneyIfValue(details, "Hausgeld/Monat", property.house_fee);
      pushMoneyIfValue(details, "Stellplatz-Preis", property.parking_space_price);

      pushAreaIfValue(details, "Wohnfläche", property.living_space);
      pushAreaIfValue(details, "Grundstücksfläche", property.plot_area);
      pushAreaIfValue(details, "Nutzfläche", property.usable_area);
      pushAreaIfValue(details, "Balkon/Terrasse Fläche", property.balcony_area);
      pushAreaIfValue(details, "Gartenfläche", property.garden_area);

      pushIfValue(details, "Zimmer", rooms);
      pushIfValue(details, "Schlafzimmer", property.bedrooms);
      pushIfValue(details, "Badezimmer", property.bathrooms);
      pushIfValue(details, "Etage", property.floor);
      pushIfValue(details, "Etagenzahl", property.number_of_floors);
      pushIfValue(details, "Etagenlage", property.floor_position);

      pushIfValue(details, "Objektart", propertyType);
      pushIfValue(details, "Vermarktung", marketingType);
      pushIfValue(details, "Objektzustand", property.condition);
      pushIfValue(details, "Verfügbar ab", property.available_from);
      pushIfValue(details, "Letzte Modernisierung", property.last_modernization);
      pushIfValue(details, "Qualität der Ausstattung", property.furnishing_quality);
      pushIfValue(details, "Anzahl Parkplätze", property.number_of_parking_spaces);
      pushIfValue(details, "Stellplatztyp", property.parking_space_type);
      pushIfValue(details, "Baujahr", constructionYear);

      pushIfValue(details, "Energieausweistyp", property.energy_certificate_type);
      pushIfValue(details, "Energieeffizienzklasse", property.energy_efficiency_class);
      pushIfValue(details, "Energieverbrauchswert", property.energy_consumption);
      pushIfValue(details, "Heizungsart", property.heating_type);
      pushIfValue(details, "Wesentlicher Energieträger", property.main_energy_source);
      pushIfValue(details, "Baujahr Anlagentechnik", property.energy_construction_year);

      const features = [];

      pushBoolIfTrue(features, "Aufzug", property.has_elevator);
      pushBoolIfTrue(features, "Keller", property.has_cellar);
      pushBoolIfTrue(features, "Einbauküche", property.has_built_in_kitchen);
      pushBoolIfTrue(features, "Loggia", property.has_loggia);
      pushBoolIfTrue(features, "Denkmalschutz", property.is_monument);
      pushBoolIfTrue(features, "Abstellraum", property.has_storage_room);
      pushBoolIfTrue(features, "Pool", property.has_pool);
      pushBoolIfTrue(features, "Alarmanlage", property.has_alarm_system);
      pushBoolIfTrue(features, "Klimaanlage", property.has_air_conditioning);
      pushBoolIfTrue(features, "Barrierefrei", property.is_barrier_free);
      pushBoolIfTrue(features, "Gäste-WC", property.has_guest_wc);
      pushBoolIfTrue(features, "Balkon/Terrasse", property.has_balcony);
      pushBoolIfTrue(features, "Garten", property.has_garden);
      pushBoolIfTrue(features, "Kamin", property.has_fireplace);
      pushBoolIfTrue(features, "Sauna", property.has_sauna);
      pushBoolIfTrue(features, "Wintergarten", property.has_winter_garden);

      pushIfValue(features, "Bad", property.bathroom_type);
      pushIfValue(features, "Bodenbelag", property.flooring_type);

      const descriptions = [];

      pushIfValue(descriptions, "Objektbeschreibung", property.description);
      pushIfValue(descriptions, "Objektbeschreibung", property.public_description);
      pushIfValue(descriptions, "Objektbeschreibung", property.long_description);
      pushIfValue(descriptions, "Lage", property.location_description);
      pushIfValue(descriptions, "Ausstattung", property.furnishing_description);
      pushIfValue(descriptions, "Sonstiges", property.other_description);

      return {
        id: property.id,
        slug,
        url: `/angebote/${slug}/`,

        title,
        image: firstImage(property),
        gallery: galleryImages(property),

        // Adresse wird absichtlich NICHT öffentlich ausgegeben
        location: shortLocation,

        marketing_type: marketingType,
        property_type: propertyType,

        price,
        living_space: livingSpace,
        rooms,
        construction_year: constructionYear,

        details,
        features,
        descriptions,

        request_url: `/objekt-anfragen.html?object_id=${property.id}&object=${encodeURIComponent(title)}`,

        raw: property
      };
    });

    console.log("PROPSTACK OBJEKTE:", properties.length);

    return {
      properties
    };

  } catch (error) {
    console.warn("Propstack Verbindung fehlgeschlagen:", error.message);

    return {
      properties: []
    };
  }
};
