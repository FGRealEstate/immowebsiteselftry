/*
 * Update 36 §2.1 (05.11.2026): Schutz gegen Test- und Fremdobjekte im Angebotsabruf.
 * Anlass: Das erfundene Objekt 6350704 („TEST Vermietete 3,5-Zimmer-Wohnung …“, Krefeld) stand live auf der Startseite.
 *
 * Ein Objekt wird übersprungen,
 *   - wenn Titel, ein Beschreibungstext oder ein Tag „TEST“, „Test-“ oder „erfunden“ enthält, oder
 *   - wenn sein Ort außerhalb der F&G-Gebiete liegt (Berlin, Brandenburg, Leipzig, Dresden).
 * Der Build protokolliert nur die Propstack-ID und den Grund, keine Objektdaten.
 *
 * Liegt in scripts/, weil Eleventy jede .js-Datei in _data/ als Daten lädt; scripts/ ist in .eleventyignore.
 */

/** Propstack liefert Felder teils als Wert, teils als { label, value } oder { pretty_value }. Nur der Wert zählt. */
function wert(feld) {
    if (feld === null || feld === undefined) return "";
    if (Array.isArray(feld)) return feld.map(wert).filter(Boolean).join(" ");
    if (typeof feld === "object") {
        const v = feld.pretty_value ?? feld.value ?? feld.name ?? feld.title ?? null;
        return v === null || typeof v === "object" ? "" : String(v);
    }
    return String(feld);
}

// „TEST“ als eigenes Wort in Großbuchstaben (nicht „Attest“, „Testament“), „Test-“ mit Bindestrich, „erfunden“ in jeder Schreibweise.
const TESTWORT = [/(^|[^A-Za-zÄÖÜäöüß])TEST($|[^A-Za-zÄÖÜäöüß])/, /(^|[^A-Za-zÄÖÜäöüß])Test-/, /erfunden/i];

// Titel und alle Texte, die Propstack für ein Objekt führt (Beschreibung, Lage, Ausstattung, Sonstiges …), dazu Tags und Gruppen.
function texte(objekt) {
    const liste = [objekt.title, objekt.name, objekt.description, objekt.description_note, objekt.exposee_title];
    for (const [schluessel, feld] of Object.entries(objekt || {})) {
        if (/_note$|_text$|^description/.test(schluessel)) liste.push(feld);
    }
    liste.push(objekt.tags, objekt.groups, objekt.labels, objekt.group_names, objekt.tag_names);
    return liste.map(wert).filter(Boolean);
}

function hatTestwort(objekt) {
    return texte(objekt).some((text) => TESTWORT.some((muster) => muster.test(text)));
}

const klein = (text) => wert(text).trim().toLocaleLowerCase("de-DE");
const STAEDTE = new Set(["berlin", "leipzig", "dresden"]);
const LAENDER = new Set(["berlin", "brandenburg"]);

/**
 * Im F&G-Gebiet, wenn eins davon zutrifft:
 * - Stadt Berlin, Leipzig oder Dresden;
 * - Bundesland (Propstack-Feld region) Berlin oder Brandenburg;
 * - PLZ 10… bis 16… (Berlin und Brandenburg), 03… (Brandenburger Lausitz), Leipzig 04103–04357, Dresden 01067–01328.
 *   Umlandorte mit eigener Stadt (z. B. Radebeul, Markkleeberg) zählen nicht dazu; der Build nennt dann ihre ID.
 * Ohne Stadt, Land und PLZ lässt sich nichts sagen; dann entscheidet der Testwort-Filter allein.
 */
function imGebiet(objekt) {
    const stadt = klein(objekt.city);
    const land = klein(objekt.region);
    const plz = wert(objekt.zip_code).replace(/\D/g, "");
    if (!stadt && !land && !plz) return true;
    if (STAEDTE.has(stadt) || LAENDER.has(land)) return true;
    if (/^(1[0-6]|03)\d{3}$/.test(plz)) return true;
    const n = Number(plz);
    if (plz.length === 5 && ((n >= 4103 && n <= 4357) || (n >= 1067 && n <= 1328))) return true;
    return false;
}

/** null, wenn das Objekt auf die Seite darf; sonst der Grund („testwort“ oder „ausserhalb“). */
function sperrgrund(objekt) {
    if (!objekt || typeof objekt !== "object") return null;
    if (hatTestwort(objekt)) return "testwort";
    if (!imGebiet(objekt)) return "ausserhalb";
    return null;
}

/** Wie sperrgrund, protokolliert aber die ID (nur die ID) und gibt true zurück, wenn das Objekt wegfällt. */
function ueberspringen(objekt, art = "Objekt") {
    const grund = sperrgrund(objekt);
    if (grund) console.warn(`Angebotsschutz: ${art} ${wert(objekt.id) || "ohne ID"} übersprungen (${grund}).`);
    return Boolean(grund);
}

module.exports = { sperrgrund, ueberspringen, hatTestwort, imGebiet };
