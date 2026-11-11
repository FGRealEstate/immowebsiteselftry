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
  teile: [place("Dresdner Norden", "dresden/nord"), place("Dresdner Süden", "dresden/sued"), place("Blasewitz & Striesen", "dresden/blasewitz-striesen"), place("Dresdner Osten", "dresden/ost")]
});

// Für das Organization-Markup: jedes Gebiet einmal, Teltow & Kleinmachnow als zwei Orte.
const schemaPlaces = [berlin, ...landkreise, ...towns, leipzig, dresden].flatMap((p) =>
  (p.schemaNames || [p.schemaName || p.name]).map((name) => ({ type: p.schemaType, name, url: p.exists ? p.url : null }))
);

// Update 55 §3.2.2 (11.11.2026): areaServed des Unternehmens (RealEstateAgent) mit jedem Gebiet, auch dem Land Brandenburg
// und den Teilgebieten mit eigener Seite (Berliner Bezirke, Leipzig, Dresden). `within`: übergeordneter Ort für
// containedInPlace. Die Leistungen (fgs-/fgd-service.njk) nutzen weiter schemaPlaces.
const teil = (stadt, t, name) => ({ type: "Place", name, url: t.exists ? t.url : null, within: stadt });
const schemaPlacesFirma = [
  ...schemaPlaces.filter((p) => p.name === "Berlin"),
  ...berlin.bezirke.map((b) => ({ type: "AdministrativeArea", name: b.name, url: b.exists ? b.url : null, within: "Berlin" })),
  { type: "State", name: "Brandenburg", url: null },
  ...schemaPlaces.filter((p) => p.name !== "Berlin" && p.name !== "Leipzig" && p.name !== "Dresden"),
  ...schemaPlaces.filter((p) => p.name === "Leipzig"),
  ...leipzig.teile.map((t) => teil("Leipzig", t, `Leipzig-${t.name}`)),
  ...schemaPlaces.filter((p) => p.name === "Dresden"),
  ...dresden.teile.map((t) => teil("Dresden", t, t.name))
];

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
  schemaPlacesFirma,
  financingArea: "Deutschland",
  text
};
