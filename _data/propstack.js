module.exports = async function () {
    const apiKey = process.env.PROPSTACK_API_KEY;

    const urls = [
        "https://crm.propstack.de/api/v1/property",
        "https://crm.propstack.de/api/v1/object",
        "https://api.propstack.de/v1/property",
        "https://api.propstack.de/v1/object"
    ];

    for (const url of urls) {
        try {
            const response = await fetch(url, {
                headers: {
                    "X-API-KEY": apiKey,
                    "Accept": "application/json"
                }
            });

            const text = await response.text();

            console.log("DEBUG URL:", url);
            console.log("DEBUG STATUS:", response.status);
            console.log("DEBUG RESPONSE:", text.slice(0, 1000));

        } catch (error) {
            console.log("DEBUG ERROR:", url, error.message);
        }
    }

    return { properties: [] };
};
