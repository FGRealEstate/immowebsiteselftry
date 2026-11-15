/* Update 54 §1 (vorbereitet mit Update 57 §11, 15.11.2026): erster Partner für Grundriss und Wohnflächenberechnung.
   Der Abschnitt „Grundriss und Wohnflächenberechnung“ (_includes/fgs-partner.njk) steht auf /verkaufen unter den Unterlagen,
   auf /vermieten unter „Unterlagen und Mietvertrag“ und auf /immobilienbewertung/ unter den Häufigen Fragen.
   Er erscheint nur, wenn der Schalter `partner` in _data/freigaben.js an ist. Live bleibt er aus, bis Timons Angaben da
   sind und Jesu den Satz geschickt hat; die Testumgebung zeigt ihn (deploy-test.sh setzt FG_FREIGABE_PARTNER=1).

   Wenn die Angaben da sind, hier eintragen:
     name   Name des Partners (auch der Wert für `partner_name` im GA4-Ereignis `partner_click`)
     link   der Link, den F&G nutzen soll (Affiliate-Link, falls es einen gibt)
     logo   Logo-Datei unter /images/partner/ (SVG oder PNG), Breite und Höhe in Pixeln
     satz   der eine Satz von Jesu: was der Partner für F&G-Kunden macht (und ggf. der Preisvorteil)
   und in _data/freigaben.js `partner: true` setzen. Kein Eintrag in Organization oder sameAs (Brief §1.5).

   Sicherung: Steht im Netlify-Produktionsbuild noch ein Platzhalter in einem Feld, bricht der Build ab. */
const PLATZHALTER = "[Platzhalter";

const partner = {
  aktiv: Boolean(require("./freigaben.js").partner),
  name: "[Platzhalter: Name des Partners]",
  link: "https://example.com/platzhalter-partnerlink",
  logo: null, // z. B. { src: "/images/partner/name.svg", breite: 160, hoehe: 48 }; ohne Logo steht der Name in Schrift
  satz: "[Platzhalter: Jesu schreibt diesen einen Satz, sobald Timons Angaben da sind. Was der Partner für F&G-Kunden macht.]"
};

if (partner.aktiv && process.env.NETLIFY === "true" && process.env.CONTEXT === "production") {
  const offen = Object.entries(partner).filter(([, wert]) => typeof wert === "string" && (wert.includes(PLATZHALTER) || wert.includes("example.com")));
  if (offen.length) throw new Error(`Partnerblock: Platzhalter in ${offen.map(([feld]) => feld).join(", ")}. Erst die echten Angaben eintragen.`);
}

module.exports = partner;
