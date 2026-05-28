module.exports = async function () {
    const apiKey = process.env.PROPSTACK_API_KEY;

    const urls = [
        "https://api.propstack.de/v1/units",
        "https://api.propstack.de/v1/units?expand=1",
        "https://api.propstack.de/v1/units?archived=-1&expand=1"
    ];

    for (const url of urls) {
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
    }

    return { properties: [] };
};
