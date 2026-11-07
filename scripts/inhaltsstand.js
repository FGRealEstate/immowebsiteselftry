// Update 42 §1.3 (07.11.2026): Tag, an dem sich der Inhalt einer Seite zuletzt geändert hat, aus Git statt aus einem
// festen Feld. Das ist das jüngste Commit-Datum (deutsche Zeit) der Dateien, aus denen die Seite gebaut wird.
// Nicht eingecheckte Änderungen an diesen Dateien (lokaler Build, Testumgebung) zählen als heute.
// Ohne vollständige Git-Geschichte (flacher Klon, der sich nicht vertiefen lässt) gibt stand() null zurück;
// die Sitemap nimmt dann wie bisher das Feld `updated` und der Build schreibt eine Warnung.
const { execFileSync } = require("child_process");

const tagInBerlin = (d) => new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit"
}).format(d);

const git = (args, cwd, timeout = 20000) => execFileSync("git", args, { cwd, encoding: "utf8", timeout, stdio: ["ignore", "pipe", "pipe"] });

const geprueft = new Map();
function gitVollstaendig(cwd) {
  if (geprueft.has(cwd)) return geprueft.get(cwd);
  let ok = false;
  try {
    if (git(["rev-parse", "--is-shallow-repository"], cwd).trim() === "true") {
      try { git(["fetch", "--unshallow", "--quiet"], cwd, 120000); } catch (error) { /* unten geprüft */ }
    }
    ok = git(["rev-parse", "--is-shallow-repository"], cwd).trim() === "false";
  } catch (error) {
    ok = false;
  }
  if (!ok) console.warn("[inhaltsstand] Keine vollständige Git-Geschichte: Sitemap-Datum aus dem Feld „updated“.");
  geprueft.set(cwd, ok);
  return ok;
}

/** Jüngster Änderungstag (JJJJ-MM-TT, deutsche Zeit) der Dateien `dateien`, oder null. */
function stand(dateien, { cwd = process.cwd(), heute = new Date() } = {}) {
  const liste = dateien.filter(Boolean);
  if (!liste.length || !gitVollstaendig(cwd)) return null;
  if (git(["status", "--porcelain", "--", ...liste], cwd).trim()) return tagInBerlin(heute);
  const ct = git(["log", "-1", "--format=%ct", "--", ...liste], cwd).trim();
  return ct ? tagInBerlin(new Date(Number(ct) * 1000)) : null;
}

module.exports = { stand, tagInBerlin };
