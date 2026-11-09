// Update 50 §1 (Vertrag Anlage A 1.4): /referenzen/ entsteht automatisch mit der ersten Referenz (Status „Verkauft“ oder
// „Vermietet“ in Propstack, siehe _data/propstack.js). Ohne Referenz wird die Seite nicht gebaut; das Menü zeigt den Link dann nicht.
module.exports = {
  eleventyComputed: {
    permalink: (data) => (((data.propstack && data.propstack.references) || []).length ? "referenzen/index.html" : false)
  }
};
