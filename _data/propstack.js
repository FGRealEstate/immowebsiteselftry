module.exports = async function () {
  const apiKey = process.env.PROPSTACK_API_KEY;
  const baseUrl = "https://crm.propstack.de/api/v1";

  if (!apiKey) {
    console.warn("PROPSTACK_API_KEY fehlt.");
    return { properties: [] };
  }

  try {
    const response = await fetch(`${baseUrl}/properties`, {
      headers: {
        "X-API-KEY": apiKey
      }
    });

    if (!response.ok) {
      console.warn("Propstack API Fehler:", response.status, await response.text());
      return { properties: [] };
    }

    const data = await response.json();
    console.log("PROPSTACK RESPONSE:", JSON.stringify(data).slice(0, 2000));

    return {
      properties: data.objects || data.data || data || []
    };
  } catch (error) {
    console.warn("Propstack Verbindung fehlgeschlagen:", error.message);
    return { properties: [] };
  }
};
