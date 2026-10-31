// Gebietsstruktur nach dem Gebiets-Brief (24.10.2026): eine Quelle für Startseite,
// Fußzeile, Standort- und Kontaktseite und das Organization-Markup.
// `exists`: Die Seite wird gebaut (neue Gebietsseite in content/gebiete/ oder alte
// Standortseite in content/standorte/). Noch nicht gebaute Seiten zeigen die Vorlagen
// als Text ohne Link; sobald ihre JSON da ist, erscheinen sie verlinkt.
// Finanzierungen werden unabhängig davon deutschlandweit begleitet.
const fs = require("fs");
const path = require("path");

const slugsIn = (name) => {
  const dir = path.join(__dirname, "..", "content", name);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((file) => file.endsWith(".json")).map((file) => {
    try {
      return JSON.parse(fs.readFileSync(path.join(dir, file), "utf8")).slug;
    } catch (error) {
      return null;
    }
  }).filter(Boolean);
};
const built = new Set([...slugsIn("gebiete"), ...slugsIn("standorte")]);

const place = (name, slug, extra = {}) => ({ name, slug, url: `/standorte/${slug}/`, exists: built.has(slug), ...extra });

const berlin = place("Berlin", "berlin", {
  schemaType: "City",
  bezirke: [
    place("Steglitz-Zehlendorf", "berlin/steglitz-zehlendorf"),
    place("Charlottenburg-Wilmersdorf", "berlin/charlottenburg-wilmersdorf"),
    place("Tempelhof-Schöneberg", "berlin/tempelhof-schoeneberg"),
    place("Pankow", "berlin/pankow")
  ]
});

const landkreise = [
  place("Oberhavel", "oberhavel"),
  place("Barnim", "barnim"),
  place("Havelland", "havelland"),
  place("Potsdam-Mittelmark", "potsdam-mittelmark"),
  place("Dahme-Spreewald", "dahme-spreewald"),
  place("Oder-Spree", "oder-spree"),
  place("Teltow-Fläming", "teltow-flaeming"),
  place("Märkisch-Oderland", "maerkisch-oderland")
].map((kreis) => ({ ...kreis, schemaType: "AdministrativeArea", schemaName: `Landkreis ${kreis.name}` }));

const towns = [
  place("Oranienburg", "oranienburg"),
  place("Bernau bei Berlin", "bernau", { short: "Bernau" }),
  place("Falkensee", "falkensee"),
  // FG-Timon-Answers-Update §4 (29.10.2026): Potsdam als eigene Stadtseite, Menü „15 Gebiete“
  place("Potsdam", "potsdam"),
  place("Teltow & Kleinmachnow", "teltow", { schemaNames: ["Teltow", "Kleinmachnow"] }),
  place("Erkner", "erkner"),
  place("Königs Wusterhausen", "konigs-wusterhausen")
].map((town) => ({ ...town, schemaType: "City" }));

const leipzig = place("Leipzig", "leipzig", {
  schemaType: "City",
  teile: [place("Zentrum", "leipzig/zentrum"), place("Nord", "leipzig/nord"), place("West", "leipzig/west")]
});

const dresden = place("Dresden", "dresden", {
  schemaType: "City",
  teile: [place("Nord", "dresden/nord"), place("Süd", "dresden/sued"), place("Zentrum", "dresden/zentrum"), place("Ost", "dresden/ost")]
});

// Für das Organization-Markup: jedes Gebiet einmal, Teltow & Kleinmachnow als zwei Orte.
const schemaPlaces = [berlin, ...landkreise, ...towns, leipzig, dresden].flatMap((p) =>
  (p.schemaNames || [p.schemaName || p.name]).map((name) => ({ type: p.schemaType, name, url: p.exists ? p.url : null }))
);

// Update 10 §4.3 (29.10.2026): Potsdam wie auf Kontakt ergänzt (FAQ A5/C6, 404, Kontakt).
const text =
  "Das Maklergeschäft von Fischer & Geserich umfasst ganz Berlin, mit eigenen Seiten für Steglitz-Zehlendorf, Charlottenburg-Wilmersdorf, Tempelhof-Schöneberg und Pankow, und das Berliner Umland in acht Brandenburger Landkreisen und in Potsdam: Oberhavel, Barnim, Havelland, Potsdam-Mittelmark, Dahme-Spreewald, Oder-Spree, Teltow-Fläming und Märkisch-Oderland. In Sachsen sind wir in Leipzig und Dresden tätig. Finanzierungen begleiten wir deutschlandweit.";

module.exports = {
  berlin,
  landkreise,
  towns,
  leipzig,
  dresden,
  schemaPlaces,
  financingArea: "Deutschland",
  text
};
