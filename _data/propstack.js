module.exports = async function () {

    const apiKey = process.env.PROPSTACK_API_KEY;
    const baseUrl = process.env.PROPSTACK_API_BASE || "https://crm.propstack.de/api/v1";

    if (!apiKey) {
        console.warn("PROPSTACK_API_KEY fehlt.");

        return {
            properties: []
        };
    }

    try {

        const response = await fetch(`${baseUrl}/properties`, {
            headers: {
                "X-API-KEY": apiKey,
                "Content-Type": "application/json"
            }
        });

        const rawText = await response.text();

        console.log("PROPSTACK RAW RESPONSE:", rawText.slice(0, 500));

        const data = JSON.parse(rawText);

        const rawProperties = data.properties || data.data || [];

        const properties = rawProperties.map(property => {

            const slug =
                (property.name || "immobilie")
                    .toLowerCase()
                    .replace(/ä/g, "ae")
                    .replace(/ö/g, "oe")
                    .replace(/ü/g, "ue")
                    .replace(/ß/g, "ss")
                    .replace(/[^a-z0-9]+/g, "-")
                    .replace(/^-|-$/g, "");

            return {

                id: property.id,

                slug: slug,

                url: `/angebote/${slug}/`,

                title:
                    property.name ||
                    property.title ||
                    "Immobilie",

                address:
                    property.short_address ||
                    property.address ||
                    "",

                city:
                    property.city ||
                    "",

                zipcode:
                    property.zipcode ||
                    "",

                marketing_type:
                    property.marketing_type ||
                    property.offer_type ||
                    "",

                property_type:
                    property.property_type ||
                    property.object_type ||
                    "",

                price:
                    property.purchase_price?.value ||
                    property.purchase_price ||
                    property.price?.value ||
                    property.price ||
                    "",

                living_space:
                    property.living_space?.value ||
                    property.living_space ||
                    "",

                rooms:
                    property.number_of_rooms?.value ||
                    property.number_of_rooms ||
                    "",

                construction_year:
                    property.construction_year?.value ||
                    property.construction_year ||
                    "",

                description:
                    property.description ||
                    property.public_description ||
                    "",

                image:
                    property.title_picture_url ||
                    property.cover_picture_url ||
                    property.image_url ||
                    "/images/placeholder.jpg",

                gallery:
                    property.pictures ||
                    property.images ||
                    [],

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
