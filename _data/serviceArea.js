// Eine verbindliche Quelle für das Maklergebiet und das Organization-Markup.
// Die Liste entspricht den vorhandenen Standortseiten; Finanzierungen werden
// unabhängig davon deutschlandweit begleitet.
const analysed = [
  { name: "Berlin", slug: "berlin", region: "Metropole" },
  { name: "Bernau", schemaName: "Bernau bei Berlin", slug: "bernau", region: "Berliner Speckgürtel · Nordost" },
  { name: "Eberswalde", slug: "eberswalde", region: "Berliner Speckgürtel · Nordost" },
  { name: "Erkner", slug: "erkner", region: "Berliner Speckgürtel · Ost" },
  { name: "Falkensee", slug: "falkensee", region: "Berliner Speckgürtel · West" },
  { name: "Fürstenwalde", slug: "furstenwalde", region: "Berliner Speckgürtel · Ost" },
  { name: "Joachimsthal", slug: "joachimsthal", region: "Berliner Speckgürtel · Nordost" },
  { name: "Königs Wusterhausen", slug: "konigs-wusterhausen", region: "Berliner Speckgürtel · Südost" },
  { name: "Luckenwalde", slug: "luckenwalde", region: "Brandenburg · Teltow-Fläming" },
  { name: "Oranienburg", slug: "oranienburg", region: "Berliner Speckgürtel · Nord" },
  { name: "Potsdam", slug: "potsdam", region: "Berliner Speckgürtel · Südwest" },
  { name: "Strausberg", slug: "strausberg", region: "Berliner Speckgürtel · Ost" },
  { name: "Teltow", slug: "teltow", region: "Berliner Speckgürtel · Südwest" },
  { name: "Velten", slug: "velten", region: "Berliner Speckgürtel · Nordwest" },
  { name: "Leipzig", slug: "leipzig", region: "Sachsen" },
  { name: "Dresden", slug: "dresden", region: "Sachsen" }
].map((place) => ({ ...place, hasPage: true }));

const serviceAreaText =
  "Das Maklergeschäft von Fischer & Geserich umfasst ganz Berlin sowie den Berliner Speckgürtel mit Bernau, Eberswalde, Erkner, Falkensee, Fürstenwalde, Joachimsthal, Königs Wusterhausen, Luckenwalde, Oranienburg, Potsdam, Strausberg, Teltow und Velten. In Sachsen sind wir in Leipzig und Dresden tätig. Finanzierungen begleiten wir deutschlandweit.";

module.exports = {
  analysed,
  all: analysed,
  financingArea: "Deutschland",
  text: serviceAreaText
};
