module.exports = async function () {
    const apiKey = process.env.PROPSTACK_API_KEY;
    const baseUrl = process.env.PROPSTACK_API_BASE || "https://crm.propstack.de/api/v1";

    if (!apiKey) {
        console.log("DEBUG: API KEY FEHLT");
        return { properties: [] };
    }

    const urls = [
        `${baseUrl}/properties`,
        `${baseUrl}/objects`,
        `https://api.propstack.de/v1/properties`,
        `https://api.propstack.de/v1/objects`,
        `https://crm.propstack.de/api/v1/properties`,
        `https://crm.propstack.de/api/v1/objects`
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
            console.log("DEBUG RESPONSE:", text.slice(0, 500));

        } catch (error) {
            console.log("DEBUG ERROR:", url, error.message);
        }
    }

    return { properties: [] };
};
