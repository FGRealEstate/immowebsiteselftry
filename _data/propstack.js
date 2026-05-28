module.exports = async function () {
  const apiKey = process.env.PROPSTACK_API_KEY;

  if (!apiKey) return { properties: [] };

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

  function isRealValue(label, value) {
    const cleaned = String(clean(value)).trim();

    if (!cleaned) return false;
    if (cleaned === "-") return false;
    if (cleaned.toLowerCase() === "keine angabe") return false;
    if (cleaned.toLowerCase() === String(label).toLowerCase()) return false;
    if (cleaned.toLowerCase().includes("null")) return false;
    if (cleaned.toLowerCase().includes("undefined")) return false;

    return true;
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
    let number = clean(value);
    if (!number) return "";

    if (typeof number === "string") {
      number = number.replace(/\./g, "").replace(",", ".").replace(/[^\d.-]/g, "");
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
    return formatNumber(value, 0);
  }

  function pushDetail(list, label, value) {
    if (isRealValue(label, value)) {
      list.push({ label, value: clean(value) });
    }
  }

  function pushMoney(list, label, value) {
    const formatted = formatMoney(value);
    if (formatted) list.push({ label, value: formatted });
  }

  function pushArea(list, label, value) {
    const formatted = formatArea(value);
    if (formatted) list.push({ label, value: formatted });
  }

  function pushBool(list, label, value) {
    if (value === true || value === "true" || value === 1 || value === "1") {
      list.push({ label, value: "Ja" });
    }
  }

  function getImageUrl(image) {
    if (!image) return "";
    if (typeof image === "string") return image;

    return (
      image.url ||
      image.src ||
      image.original_url ||
      image.large_url ||
      image.medium_url ||
      image.file_url ||
      image.download_url ||
      ""
    );
  }

  function getGallery(property) {
    const rawImages = [
      ...(property.images || []),
      ...(property.pictures || []),
      ...(property.photos || []),
      ...(property.media || [])
    ];

    return rawImages.map(getImageUrl).filter(Boolean);
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

    if (!response.ok) return { properties: [] };

    const data = await response.json();
    const rawProperties = data.data || [];

    const properties = rawProperties.map((property) => {
      const title = property.name || property.title || property.heading || "Immobilie";
      const slug = slugify(`${title}-${property.id}`);

      const gallery = getGallery(property);

      const image =
        gallery[0] ||
        getImageUrl(property.title_picture) ||
        getImageUrl(property.cover_picture) ||
        property.title_picture_url ||
        property.cover_picture_url ||
        property.image_url ||
        "/images/placeholder.jpg";

      const details = [];
      pushMoney(details, "Kaufpreis", property.purchase_price);
      pushMoney(details, "Preis/qm", property.price_per_sqm);
      pushMoney(details, "Kaltmiete", property.cold_rent);
      pushMoney(details, "Warmmiete", property.warm_rent);
      pushMoney(details, "Nebenkosten", property.service_charges);
      pushMoney(details, "Hausgeld/Monat", property.house_fee);
      pushMoney(details, "Stellplatz-Preis", property.parking_space_price);

      pushArea(details, "Wohnfläche", property.living_space);
      pushArea(details, "Grundstücksfläche", property.plot_area);
      pushArea(details, "Nutzfläche", property.usable_area);
      pushArea(details, "Balkon/Terrasse Fläche", property.balcony_area);
      pushArea(details, "Gartenfläche", property.garden_area);

      pushDetail(details, "Zimmer", formatInteger(property.number_of_rooms || property.rooms));
      pushDetail(details, "Schlafzimmer", property.bedrooms);
      pushDetail(details, "Badezimmer", property.bathrooms);
      pushDetail(details, "Etage", property.floor);
      pushDetail(details, "Etagenzahl", property.number_of_floors);
      pushDetail(details, "Etagenlage", property.floor_position);

      pushDetail(details, "Objektart", property.property_type || property.object_type || property.category);
      pushDetail(details, "Vermarktung", property.marketing_type || property.rs_type || property.offer_type);
      pushDetail(details, "Objektzustand", property.condition);
      pushDetail(details, "Verfügbar ab", property.available_from);
      pushDetail(details, "Letzte Modernisierung", property.last_modernization);
      pushDetail(details, "Qualität der Ausstattung", property.furnishing_quality);
      pushDetail(details, "Anzahl Parkplätze", property.number_of_parking_spaces);
      pushDetail(details, "Stellplatztyp", property.parking_space_type);
      pushDetail(details, "Baujahr", property.construction_year || property.building_year);

      pushDetail(details, "Energieausweistyp", property.energy_certificate_type);
      pushDetail(details, "Energieeffizienzklasse", property.energy_efficiency_class);
      pushDetail(details, "Energieverbrauchswert", property.energy_consumption);
      pushDetail(details, "Heizungsart", property.heating_type);
      pushDetail(details, "Wesentlicher Energieträger", property.main_energy_source);

      const features = [];
      pushBool(features, "Aufzug", property.has_elevator);
      pushBool(features, "Keller", property.has_cellar);
      pushBool(features, "Einbauküche", property.has_built_in_kitchen);
      pushBool(features, "Balkon/Terrasse", property.has_balcony);
      pushBool(features, "Garten", property.has_garden);
      pushBool(features, "Kamin", property.has_fireplace);
      pushBool(features, "Sauna", property.has_sauna);
      pushBool(features, "Barrierefrei", property.is_barrier_free);
      pushDetail(features, "Bad", property.bathroom_type);
      pushDetail(features, "Bodenbelag", property.flooring_type);

      const descriptions = [];
      pushDetail(descriptions, "Objektbeschreibung", property.description || property.public_description || property.long_description);
      pushDetail(descriptions, "Lage", property.location_description);
      pushDetail(descriptions, "Ausstattung", property.furnishing_description);
      pushDetail(descriptions, "Sonstiges", property.other_description);

      return {
        id: property.id,
        slug,
        url: `/angebote/${slug}/`,
        title,
        image,
        gallery,
        location: clean(property.city) || clean(property.region) || "Deutschland",
        marketing_type: clean(property.marketing_type || property.rs_type || property.offer_type),
        property_type: clean(property.property_type || property.object_type || property.category),
        price: formatMoney(property.purchase_price || property.price || property.cold_rent),
        living_space: formatArea(property.living_space),
        rooms: formatInteger(property.number_of_rooms || property.rooms),
        construction_year: clean(property.construction_year || property.building_year),
        details,
        features,
        descriptions,
        request_url: `/objekt-anfragen.html?object_id=${property.id}&object=${encodeURIComponent(title)}`
      };
    });

    return { properties };
  } catch (error) {
    console.warn("Propstack Verbindung fehlgeschlagen:", error.message);
    return { properties: [] };
  }
};
