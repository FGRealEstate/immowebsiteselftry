module.exports = async function () {
  const apiKey = process.env.PROPSTACK_API_KEY;

  if (!apiKey) {
    console.warn("PROPSTACK_API_KEY fehlt.");
    return { properties: [] };
  }

  try {
    const response = await fetch("https://api.propstack.de/v1/units?with_meta=1&expand=1&archived=-1", {
      headers: {
        "X-API-KEY": apiKey,
        "Accept": "application/json"
      }
    });

    if (!response.ok) {
      console.warn("Propstack API Fehler:", response.status, await response.text());
      return { properties: [] };
    }

    const data = await response.json();

    console.log("PROPSTACK RAW RESPONSE:", JSON.stringify(data).slice(0, 3000));

    return {
      properties: data.data || []
    };

  } catch (error) {
    console.warn("Propstack Verbindung fehlgeschlagen:", error.message);
    return { properties: [] };
  }
};
