// Dringend-Fix 02.11.2026: In Netlify steht PROPSTACK_API_BASE=https://crm.propstack.de/api/v1.
// Diese Adresse leitet per 301 auf https://api.propstack.de/v1 um, und fetch macht dabei aus POST ein GET:
// Statt einen Kontakt anzulegen, kam die Kontaktliste zurück, und keine Anfrage landete in Propstack.
const STANDARD = "https://api.propstack.de/v1";

function basis(env = process.env) {
  const roh = String(env.PROPSTACK_API_BASE || "").trim().replace(/\/+$/, "");
  if (!roh) return STANDARD;
  // alte Adresse (auch mit Unterpfad) auf die neue umschreiben
  const alt = roh.match(/^https?:\/\/crm\.propstack\.de\/api\/v1(\/.*)?$/i);
  if (alt) return STANDARD + (alt[1] || "");
  return roh;
}

module.exports = { basis, STANDARD };
