// Update 42 §2 (07.11.2026): Blogartikel veröffentlichen sich an ihrem Datum selbst.
//
// Der Plan steht in _data/blogplan.json: je Artikel Nummer, Slug, Datum (`datum`) und, sobald er fertig ist,
// der Zeitpunkt `bereit` (Timons Korrekturen eingearbeitet, Bilder ohne Menschen und Hände; gesetzt mit
// `python3 Blogs/design-muster/_build/live.py <Repo> --bereit <slug>`). Jeder Build rechnet daraus mit der
// deutschen Uhrzeit, welche Artikel erscheinen:
// - Ein Artikel erscheint ab seinem Datum, wenn er bis 18:00 Uhr am Vorabend bereit war und seine Seite im Repo liegt.
// - War er das nicht, überspringt ihn der Build; er rückt auf den nächsten freien Termin (Dienstag oder Freitag,
//   an dem kein anderer Artikel steht). Nie zwei an einem Termin.
// - Artikel mit einem Datum vor `automatikSeit` waren schon vorher von Hand live und bleiben es.
// Zum Testen gibt FG_JETZT (ISO-Zeit, z. B. 2026-11-08T06:00+01:00) dem Build eine andere Uhrzeit.
//
// Aufruf: node scripts/blogplan.js        Plan mit tatsächlichen Terminen
//         node scripts/blogplan.js abend  Abendprüfung um 18 Uhr: Ist der Artikel von morgen bereit?
const fs = require("fs");
const path = require("path");

const TAGE = { 2: "Di", 5: "Fr" };

/** "JJJJ-MM-TT" des Zeitpunkts in deutscher Zeit */
function tag(d) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

/** Zeitpunkt „Tag um hh:mm deutscher Zeit“ (MEZ oder MESZ des Tages) */
function inBerlin(t, hh, mm = 0) {
  const versatz = new Intl.DateTimeFormat("en", { timeZone: "Europe/Berlin", timeZoneName: "longOffset" })
    .formatToParts(new Date(`${t}T12:00:00Z`)).find((x) => x.type === "timeZoneName").value.replace("GMT", "") || "+00:00";
  return new Date(`${t}T${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:00${versatz}`);
}

const plusTage = (t, n) => new Date(Date.parse(`${t}T12:00:00Z`) + n * 864e5).toISOString().slice(0, 10);
const wochentag = (t) => new Date(`${t}T12:00:00Z`).getUTCDay();
const istTermin = (t) => wochentag(t) in TAGE;

/** Frist: 18:00 Uhr am Abend vor dem Datum */
const frist = (datum) => inBerlin(plusTage(datum, -1), 18);

/** Nächster Dienstag oder Freitag nach `t`, an dem kein Artikel steht */
function naechsterFreierTermin(t, belegt) {
  let d = plusTage(t, 1);
  while (!istTermin(d) || belegt.has(d)) d = plusTage(d, 1);
  return d;
}

function jetztAusUmgebung() {
  const j = process.env.FG_JETZT;
  if (!j) return new Date();
  const d = new Date(j);
  if (Number.isNaN(d.getTime())) throw new Error(`blogplan: FG_JETZT „${j}“ ist keine Zeit`);
  return d;
}

/**
 * Tatsächlicher Plan zum Zeitpunkt `jetzt`.
 * vorhanden(slug): liegt die Seite des Artikels im Repo (blog/<slug>/index.html aus live.py)?
 * Ergebnis je Artikel: { ...eintrag, termin, status, verschoben: [{ von, nach }] }
 *   status: "live" (erscheint), "bereit" (fertig, Datum kommt noch), "offen" (noch nicht fertig, Frist läuft noch)
 */
function zeitplan(plan, { jetzt = new Date(), vorhanden = () => true } = {}) {
  const seit = plan.automatikSeit;
  const artikel = [...plan.artikel].sort((a, b) => a.datum.localeCompare(b.datum) || a.nr - b.nr);
  const belegt = new Set();
  for (const a of artikel) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(a.datum)) throw new Error(`blogplan: Nr. ${a.nr} hat kein Datum JJJJ-MM-TT`);
    if (a.datum < seit) continue; // vor der Automatik von Hand live, auch zwei an einem Tag (22.10., 31.10.)
    if (belegt.has(a.datum)) throw new Error(`blogplan: zwei Artikel am ${a.datum} (Nr. ${a.nr}); nie zwei an einem Termin`);
    // Kein Abbruch: Ein falscher Wochentag soll den 6-Uhr-Build nicht anhalten. npm test prüft den Plan (blogplan.test.js).
    if (!istTermin(a.datum)) console.warn(`blogplan: Nr. ${a.nr} am ${a.datum} ist kein Dienstag oder Freitag`);
    belegt.add(a.datum);
  }
  const heute = tag(jetzt);
  return artikel.map((a) => {
    if (a.datum < seit) {
      if (!vorhanden(a.slug)) throw new Error(`blogplan: Nr. ${a.nr} (${a.slug}) war live, die Seite fehlt`);
      return { ...a, termin: a.datum, status: "live", verschoben: [] };
    }
    const bereit = a.bereit ? new Date(a.bereit) : null;
    if (bereit && Number.isNaN(bereit.getTime())) throw new Error(`blogplan: Nr. ${a.nr}: bereit „${a.bereit}“ ist keine Zeit`);
    const fertigBis = (d) => Boolean(bereit) && bereit <= frist(d) && vorhanden(a.slug);
    const verschoben = [];
    let d = a.datum;
    for (;;) {
      if (jetzt < frist(d)) return { ...a, termin: d, status: fertigBis(d) ? "bereit" : "offen", verschoben };
      if (fertigBis(d)) return { ...a, termin: d, status: d <= heute ? "live" : "bereit", verschoben };
      const neu = naechsterFreierTermin(d, belegt);
      belegt.add(neu);
      verschoben.push({ von: d, nach: neu });
      d = neu;
    }
  });
}

/**
 * Die Artikel, die zum Zeitpunkt `jetzt` erscheinen, im Format der früheren _data/blog.json
 * (slug, url, kategorie, titel, kurz, datePublished, dateModified), nach Datum.
 * quelle: Karten aus live.py (_data/blogquelle.json), je Slug Kategorie, Titel und Kurztext.
 */
function veroeffentlicht(plan, quelle, { jetzt = new Date(), vorhanden } = {}) {
  const karten = new Map(quelle.map((k) => [k.slug, k]));
  const da = vorhanden || ((slug) => karten.has(slug));
  return zeitplan(plan, { jetzt, vorhanden: (slug) => karten.has(slug) && da(slug) })
    .filter((a) => a.status === "live")
    .map((a) => {
      const k = karten.get(a.slug);
      return {
        slug: a.slug, url: `/blog/${a.slug}/`, kategorie: k.kategorie, titel: k.titel, kurz: k.kurz,
        datePublished: a.termin, dateModified: a.geaendert && a.geaendert > a.termin ? a.geaendert : a.termin
      };
    });
}

/**
 * _redirects für den Build: Zeilen „/wissen/<alt> /blog/<slug>/ 301“ eines Artikels aus dem Plan gelten, sobald er
 * erscheint, sonst stehen sie auskommentiert da und die Adresse geht über „/wissen/* /blog/ 302“ (Brief §2.3).
 * Alle anderen Zeilen bleiben, wie sie in der Datei stehen.
 */
function weiterleitungen(text, plan, liveSlugs) {
  const imPlan = new Set(plan.artikel.map((a) => a.slug));
  const live = new Set(liveSlugs);
  return text.split("\n").map((zeile) => {
    const m = zeile.match(/^(?:#\s*)?(\/wissen\/\S+)\s+\/blog\/([a-z0-9-]+)\/\s+301\s*$/);
    if (!m || !imPlan.has(m[2])) return zeile;
    const regel = `${m[1]} /blog/${m[2]}/ 301`;
    return live.has(m[2]) ? regel : `# ${regel}`;
  }).join("\n");
}

const deutsch = (t) => `${TAGE[wochentag(t)] || ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"][wochentag(t)]} ${t.slice(8, 10)}.${t.slice(5, 7)}.${t.slice(0, 4)}`;

/** Abendprüfung: Text für den Bericht an Peer („Send this to Jesu“), oder null, wenn morgen nichts fehlt. */
function abendpruefung(plan, { jetzt = new Date(), vorhanden } = {}) {
  const morgen = plusTage(tag(jetzt), 1);
  const ohneDiesen = zeitplan(plan, { jetzt, vorhanden });
  const faellig = ohneDiesen.filter((a) => a.verschoben.some((v) => v.von === morgen) || a.termin === morgen);
  return faellig.map((a) => {
    const v = a.verschoben.find((x) => x.von === morgen);
    if (v) return { nr: a.nr, slug: a.slug, bereit: false, neuerTermin: v.nach,
      text: `Send this to Jesu: Nr. ${a.nr} (${a.slug}) was not ready by 18:00 on ${deutsch(plusTage(morgen, -1))}. The build skips it on ${deutsch(morgen)}; it moves to the next free date, ${deutsch(v.nach)}.` };
    return { nr: a.nr, slug: a.slug, bereit: a.status === "bereit" || a.status === "live", neuerTermin: null,
      text: a.status === "offen"
        ? `Nr. ${a.nr} (${a.slug}) is due on ${deutsch(morgen)} and not ready yet; deadline 18:00 today.`
        : `Nr. ${a.nr} (${a.slug}) is ready and goes live with the 06:00 build on ${deutsch(morgen)}.` };
  });
}

function ladePlan(repo = path.join(__dirname, "..")) {
  const plan = JSON.parse(fs.readFileSync(path.join(repo, "_data", "blogplan.json"), "utf8"));
  const datei = path.join(repo, "_data", "blogquelle.json");
  const quelle = fs.existsSync(datei) ? JSON.parse(fs.readFileSync(datei, "utf8")) : [];
  const karten = new Set(quelle.map((k) => k.slug));
  const vorhanden = (slug) => karten.has(slug) && fs.existsSync(path.join(repo, "blog", slug, "index.html"));
  return { plan, quelle, vorhanden };
}

module.exports = { tag, inBerlin, frist, istTermin, naechsterFreierTermin, zeitplan, veroeffentlicht, weiterleitungen, abendpruefung, jetztAusUmgebung, ladePlan, deutsch };

if (require.main === module) {
  const { plan, vorhanden } = ladePlan();
  const jetzt = jetztAusUmgebung();
  if (process.argv[2] === "abend") {
    const r = abendpruefung(plan, { jetzt, vorhanden });
    console.log(r.length ? r.map((x) => x.text).join("\n") : `Kein Artikel am ${deutsch(plusTage(tag(jetzt), 1))}.`);
  } else {
    for (const a of zeitplan(plan, { jetzt, vorhanden })) {
      const weg = a.verschoben.length ? `  (verschoben von ${a.verschoben.map((v) => v.von).join(", ")})` : "";
      console.log(`${String(a.nr).padStart(2)}  ${deutsch(a.termin)}  ${a.status.padEnd(6)}  ${a.slug}${weg}`);
    }
  }
}
