// Update 29 §6 (02.11.2026): sameAs der Firma für alle Organization-/RealEstateAgent-Einträge im Markup,
// eine Quelle für Startseite, Kontakt und Gebietsseiten. LinkedIn und Instagram wie im Seitenfuß,
// Google-Unternehmensprofil als feste Maps-Adresse (CID) aus google.js.
const google = require("./google.js");

module.exports = [
  "https://www.linkedin.com/company/fischer-geserich-real-estate-gmbh/",
  "https://www.instagram.com/fg.immobilien/",
  "https://openregister.de/company/DE-HRB-F1103-283559",
  google.mapsUrl,
];
