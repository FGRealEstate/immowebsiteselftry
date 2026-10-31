// Ansprechpartner der Gebietsseiten (Brief Gebietsseiten §3, Entscheidung Timon).
// Alle Gebietsseiten lesen nur aus dieser Datei. Direktnummer, E-Mail, Foto und
// Kurzbio von Lennart erfragt Jesu bei Timon (Stand 25.10.2026). Bis sie da sind,
// bleiben `phone` und `email` leer, und die Seiten zeigen die Büronummer und info@.
// Wenn die Daten kommen: hier eintragen, sonst nichts ändern.
const nav = require("./nav.js");

const profile = (label) => nav.menu.flatMap((group) => group.items).find((item) => item.label === label);

module.exports = {
  lennart: {
    name: "Lennart Geserich",
    role: "Head of Sales & Vermietung",
    // Direktdurchwahl, z. B. { display: "+49 …", href: "tel:+49…" }; leer = Büronummer
    phone: null,
    // Direkte E-Mail; leer = info@
    email: null,
    photo: "/images/home/team-lennart-geserich-720.webp",
    photoSrcset: "/images/home/team-lennart-geserich-480.webp 480w, /images/home/team-lennart-geserich-720.webp 720w",
    profile: profile("Lennart Geserich"),
    // Kurzbio wörtlich aus Update 8 §1.2 (Timons Dokument, 29.10.2026); erscheint auf Über uns, Bibliothek, den Gebietsseiten,
    // unter seinen Blogartikeln, auf seinem Profil und als description im Person-Markup
    bio: "Lennart ist ausgebildeter Immobilienkaufmann und arbeitet seit rund zehn Jahren in der Immobilienbranche. Er verkauft und vermietet Ihre Immobilie, von der Wertermittlung bis zur Schlüsselübergabe, und führt die ersten Gespräche mit neuen Kaufinteressenten.",
    // Part 3 corrections (31.10.2026), Änderung 2: Halbsatz zu den ersten Gesprächen mit Kaufinteressenten ergänzt
    // Teil B (31.10.2026): Gebiete nach Update 13 §7; erscheint als Rollenzeile auf der Startseite
    gebiet: "Ansprechpartner für Süd- und West-Berlin und Südbrandenburg",
    // Final Copy Pass §13 (29.10.2026): Zeile „Ausbildung“ im Profil und hasCredential im Person-Markup
    ausbildung: "Immobilienkaufmann"
  },
  timon: {
    name: "Timon Fischer",
    role: "Finanzierung & Prozesse",
    phone: null,
    email: null,
    photo: "/images/home/team-timon-fischer-720.webp",
    photoSrcset: "/images/home/team-timon-fischer-480.webp 480w, /images/home/team-timon-fischer-720.webp 720w",
    profile: profile("Timon Fischer"),
    // Kurzbio wörtlich aus Update 8 §1.2 (29.10.2026); dieselben Stellen wie bei Lennart.
    // Update 13 §2: Timon hat keinen Abschluss; „Mathematiker aus Dresden“ gestrichen, ebenso ausbildung (Profilzeile, hasCredential).
    bio: "Timon kümmert sich um die Finanzierungen. Er rechnet mit Ihnen durch, was eine Immobilie im Monat kostet und welche Bank dafür infrage kommt. Meist übernimmt er auch die Vermarktung der Immobilien, und in seinen Gebieten begleitet er Verkäufe und Vermietungen.",
    // Part 3 corrections (31.10.2026), Änderung 3: letzter Satz ergänzt (Vermarktung meist bei Timon)
    gebiet: "Ansprechpartner für Nord- und Ost-Berlin, Nordbrandenburg, Leipzig und Dresden"
  }
};
