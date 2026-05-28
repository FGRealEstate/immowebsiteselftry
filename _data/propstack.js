const axios = require("axios");

module.exports = async function () {
  const apiKey = process.env.PROPSTACK_API_KEY;

  const response = await axios.get(
    "https://api.propstack.de/v1/objects",
    {
      headers: {
        "X-API-KEY": apiKey,
      },
    }
  );

  return response.data;
};
