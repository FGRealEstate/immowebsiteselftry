require("dotenv").config();

const axios = require("axios");

function formatPrice(value) {
    if (!value || isNaN(value)) return null;

    return new Intl.NumberFormat("de-DE", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(value) + " €";
}

function cleanValue(value) {
    if (
        value === null ||
        value === undefined ||
        value === "" ||
        value === "0" ||
        value === 0 ||
        value === "null" ||
        value === "undefined"
    ) {
        return null;
    }

    return value;
}

module.exports = async function () {

    try {

        const response = await axios.get(
            "https://api.propstack.de/v1/properties",
            {
                headers: {
                    "X-API-KEY": process.env.PROPSTACK_API_KEY
                }
            }
        );

        const properties = response.data || [];

        const cleaned = properties.map(property => {

            const price =
                cleanValue(property?.marketing_price?.value) ||
                cleanValue(property?.price) ||
                cleanValue(property?.purchase_price);

            const images =
                property?.images ||
                property?.media ||
                property?.documents ||
                [];

            const publicImages = images
                .filter(img =>
                    img?.is_public !== false &&
                    img?.url
                )
                .map(img => ({
                    url: img.url,
                    title: img.title || property.name
                }));

            return {

                id: property.id,

                slug:
                    property.slug ||
                    property.id,

                title:
                    cleanValue(property?.title) ||
                    cleanValue(property?.name) ||
                    "Immobilie",

                city:
                    cleanValue(property?.address?.city) ||
                    cleanValue(property?.city),

                zipcode:
                    cleanValue(property?.address?.zipcode),

                living_space:
                    cleanValue(property?.living_space),

                plot_area:
                    cleanValue(property?.plot_area),

                rooms:
                    cleanValue(property?.rooms),

                bedrooms:
                    cleanValue(property?.bedrooms),

                bathrooms:
                    cleanValue(property?.bathrooms),

                floor:
                    cleanValue(property?.floor),

                floors:
                    cleanValue(property?.floors),

                year:
                    cleanValue(property?.construction_year),

                parking:
                    cleanValue(property?.parking_space_type),

                parking_amount:
                    cleanValue(property?.parking_space_count),

                condition:
                    cleanValue(property?.condition),

                heating:
                    cleanValue(property?.heating_type),

                energy_class:
                    cleanValue(property?.energy_class),

                furnishing:
                    cleanValue(property?.furnishing),

                available_from:
                    cleanValue(property?.available_from),

                description:
                    cleanValue(property?.description),

                equipment:
                    cleanValue(property?.equipment_description),

                location_description:
                    cleanValue(property?.location_description),

                other:
                    cleanValue(property?.other_information),

                marketing_type:
                    cleanValue(property?.marketing_type?.name) ||
                    cleanValue(property?.marketing_type),

                property_type:
                    cleanValue(property?.property_type?.name) ||
                    cleanValue(property?.property_type),

                price_raw: price,

                price:
                    formatPrice(price),

                price_per_sqm:
                    property?.living_space && price
                        ? formatPrice(price / property.living_space)
                        : null,

                images: publicImages,

                main_image:
                    publicImages?.length
                        ? publicImages[0].url
                        : null,

                raw: property
            };

        });

        return {
            properties: cleaned
        };

    } catch (error) {

        console.error(error);

        return {
            properties: []
        };

    }

};
