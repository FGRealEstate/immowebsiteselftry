module.exports = async function () {
  const apiKey = process.env.PROPSTACK_API_KEY;

  if (!apiKey) {
    return { properties: [] };
  }

  function clean(value) {
    if (!value) return "";
    if (typeof value === "object") {
      return value.pretty_value || value.value || value.name || "";
    }
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
      const title = property.name || property.title || "Immobilie";
      const slug = slugify(`${title}-${property.id}`);

      const image =
        property.title_picture_url ||
        property.cover_picture_url ||
        property.image_url ||
        property.images?.[0]?.url ||
        property.pictures?.[0]?.url ||
        "/images/placeholder.jpg";

      return {
        id: property.id,
        slug,
        url: `/angebote/${slug}/`,

        title,
        address: property.short_address || property.address || "Adresse auf Anfrage",
        city: property.city || "",
        zipcode: property.zipcode || "",

        marketing_type: clean(property.marketing_type) || clean(property.rs_type) || "Immobilie",
        property_type: clean(property.property_type) || clean(property.object_type) || clean(property.category),

        price: clean(property.purchase_price) || clean(property.price) || clean(property.cold_rent),
        living_space: clean(property.living_space) || clean(property.surface) || clean(property.area),
        rooms: clean(property.number_of_rooms) || clean(property.rooms),
        construction_year: clean(property.construction_year) || clean(property.building_year),

        description:
          property.description ||
          property.public_description ||
          property.long_description ||
          "",

        image,
        gallery: property.images || property.pictures || [],
        raw: property
      };
    });

    console.log("PROPSTACK OBJEKTE:", properties.length);

    return { properties };

  } catch (error) {
    console.warn("Propstack Verbindung fehlgeschlagen:", error.message);
    return { properties: [] };
  }
};
