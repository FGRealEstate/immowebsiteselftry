/* Update 48 §3 (07.11.2026): Berliner Bezirke und Ortsteile, gemeinsam für _data/propstack.js (Gebietsblock und
   Ansprechpartner der Objektseiten) und netlify/functions/_shared/ansprechpartner.js (Zeile „Ansprechpartner laut Gebiet“
   in den Formularen). Inhalt unverändert aus _data/propstack.js übernommen; Quellen und Regeln stehen dort. */
const BERLIN_ORTSTEILE = {
    "berlin/charlottenburg-wilmersdorf": ["Charlottenburg", "Wilmersdorf", "Schmargendorf", "Grunewald", "Westend", "Charlottenburg-Nord", "Halensee"],
    "berlin/pankow": ["Prenzlauer Berg", "Weißensee", "Blankenburg", "Heinersdorf", "Karow", "Stadtrandsiedlung Malchow", "Pankow", "Blankenfelde", "Buch", "Französisch Buchholz", "Niederschönhausen", "Rosenthal", "Wilhelmsruh"],
    "berlin/steglitz-zehlendorf": ["Steglitz", "Lichterfelde", "Lankwitz", "Zehlendorf", "Dahlem", "Nikolassee", "Wannsee", "Schlachtensee"],
    "berlin/tempelhof-schoeneberg": ["Schöneberg", "Friedenau", "Tempelhof", "Mariendorf", "Marienfelde", "Lichtenrade"]
};

const BERLIN_BEZIRKE_OHNE_SEITE = {
    "Mitte": { kontakt: "lennart", ortsteile: ["Mitte", "Moabit", "Hansaviertel", "Tiergarten", "Wedding", "Gesundbrunnen"] },
    "Friedrichshain-Kreuzberg": { kontakt: "lennart", ortsteile: ["Friedrichshain", "Kreuzberg"] },
    "Spandau": { kontakt: "lennart", ortsteile: ["Spandau", "Haselhorst", "Siemensstadt", "Staaken", "Gatow", "Kladow", "Hakenfelde", "Falkenhagener Feld", "Wilhelmstadt"] },
    "Neukölln": { kontakt: "lennart", ortsteile: ["Neukölln", "Britz", "Buckow", "Rudow", "Gropiusstadt"] },
    "Treptow-Köpenick": { kontakt: "timon", ortsteile: ["Alt-Treptow", "Plänterwald", "Baumschulenweg", "Johannisthal", "Niederschöneweide", "Altglienicke", "Adlershof", "Bohnsdorf", "Oberschöneweide", "Köpenick", "Friedrichshagen", "Rahnsdorf", "Grünau", "Müggelheim", "Schmöckwitz"] },
    "Marzahn-Hellersdorf": { kontakt: "timon", ortsteile: ["Marzahn", "Biesdorf", "Kaulsdorf", "Mahlsdorf", "Hellersdorf"] },
    "Lichtenberg": { kontakt: "timon", ortsteile: ["Friedrichsfelde", "Karlshorst", "Lichtenberg", "Falkenberg", "Malchow", "Wartenberg", "Neu-Hohenschönhausen", "Alt-Hohenschönhausen", "Fennpfuhl", "Rummelsburg"] },
    "Reinickendorf": { kontakt: "timon", ortsteile: ["Reinickendorf", "Tegel", "Konradshöhe", "Heiligensee", "Frohnau", "Hermsdorf", "Waidmannslust", "Lübars", "Wittenau", "Märkisches Viertel", "Borsigwalde"] }
};

module.exports = { BERLIN_ORTSTEILE, BERLIN_BEZIRKE_OHNE_SEITE };
