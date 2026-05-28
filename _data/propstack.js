module.exports = async function () {
  const apiKey = process.env.PROPSTACK_API_KEY;

  try {
    const response = await fetch("https://api.propstack.de/v1/objects", {
      headers: {
        "X-API-KEY": apiKey,
        "Accept": "application/json"
      }
    });

    const text = await response.text();

    console.log("PROPSTACK RAW RESPONSE:", text.slice(0, 500));

    const data = JSON.parse(text);

    return {
      properties: data.objects || data.data || []
    };

  } catch (error) {
    console.log("PROPSTACK ERROR:", error.message);

    return {
      properties: []
    };
  }
};
