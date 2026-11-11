// Update 42 §2 (07.11.2026): Blogartikel veröffentlichen sich an ihrem Datum selbst.
//
// Der Plan steht in _data/blogplan.json: je Artikel Nummer, Slug, Datum (`datum`) und, sobald er fertig ist,
// der Zeitpunkt `bereit` (Timons Korrekturen eingearbeitet, Bilder ohne Menschen und Hände; gesetzt mit
// `python3 Blogs/design-muster/_build/live.py <Repo> --bereit <slug>`). Jeder Build rechnet daraus mit der
// deutschen Uhrzeit, welche Artikel erscheinen:
// - Termine sind alle Dienstage und Freitage ab dem ersten Datum im Plan, je Termin genau ein Artikel.
// - Update 55 §1.3 (11.11.2026): Ein Termin geht an den ersten Artikel in der Reihenfolge des Plans (`datum`), der bis
//   18:00 Uhr am Vorabend bereit war und dessen Seite im Repo liegt. Ist der geplante Artikel nicht bereit, nimmt der
//   nächste bereite den Termin; der späte bekommt den nächsten Termin, nachdem er bereit ist. Nie ans Ende der Reihe,
//   nie ein leerer Dienstag oder Freitag, solange irgendein Artikel bereit ist. Vorher (Update 42) rückte ein später
//   Artikel auf den nächsten Termin, an dem kein Artikel stand, also ans Ende des Plans.
// - Termine, deren Frist noch läuft, sind eine Vorschau: die übrigen Artikel in der Reihenfolge des Plans.
// - Artikel mit einem Datum vor `automatikSeit` waren schon vorher von Hand live und bleiben es.
// Zum Testen gibt FG_JETZT (ISO-Zeit, z. B. 2026-11-08T06:00+01:00) dem Build eine andere Uhrzeit.
//
// Aufruf: node scripts/blogplan.js        Plan mit tatsächlichen Terminen
//         node scripts/blogplan.js abend  Abendprüfung: Wer erscheint morgen, ist der nächste Artikel bereit?
// Die Abendprüfung läuft seit Update 55 §1.4 als geplante Netlify-Funktion Mo und Do 18:00 deutscher Zeit
// (netlify/functions/blog-abendpruefung.js) und schreibt Peer, wenn der nächste Artikel nicht bereit ist.
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
function naechsterFreierTermin(t, belegt = new Set()) {
  let d = plusTage(t, 1);
  while (!istTermin(d) || belegt.has(d)) d = plusTage(d, 1);
  return d;
}

/** Erster Dienstag oder Freitag ab `t` (einschließlich) */
const ersterTermin = (t) => (istTermin(t) ? t : naechsterFreierTermin(t));

function jetztAusUmgebung() {
  const j = process.env.FG_JETZT;
  if (!j) return new Date();
  const d = new Date(j);
  if (Number.isNaN(d.getTime())) throw new Error(`blogplan: FG_JETZT „${j}“ ist keine Zeit`);
  return d;
}

/**
 * Rechnet die Termine zum Zeitpunkt `jetzt` (Update 55 §1.3).
 * Ergebnis: artikel wie bei zeitplan(), dazu termine: je Dienstag/Freitag ab dem ersten Datum
 *   { termin, nr, slug, entschieden, uebersprungen }
 *   entschieden: Frist (18:00 am Vorabend) vorbei; nr/slug null = kein Artikel war bereit (leerer Termin)
 *   uebersprungen: Artikel, die in der Reihe vor dem gewählten standen und zur Frist nicht bereit waren
 */
function rechne(plan, { jetzt = new Date(), vorhanden = () => true } = {}) {
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
  const ergebnis = new Map();
  for (const a of artikel) {
    if (a.datum >= seit) continue;
    if (!vorhanden(a.slug)) throw new Error(`blogplan: Nr. ${a.nr} (${a.slug}) war live, die Seite fehlt`);
    ergebnis.set(a, { termin: a.datum, status: "live" });
  }
  const reihe = artikel.filter((a) => a.datum >= seit);
  const bereitAb = new Map(reihe.map((a) => {
    const b = a.bereit ? new Date(a.bereit) : null;
    if (b && Number.isNaN(b.getTime())) throw new Error(`blogplan: Nr. ${a.nr}: bereit „${a.bereit}“ ist keine Zeit`);
    return [a, b];
  }));
  const fertigBis = (a, d) => Boolean(bereitAb.get(a)) && bereitAb.get(a) <= frist(d) && vorhanden(a.slug);
  const termine = [];
  const offen = [...reihe];
  let d = reihe.length ? ersterTermin(reihe[0].datum) : null;
  while (offen.length) {
    if (jetzt < frist(d)) {
      // Vorschau: Die Frist läuft noch, die übrigen Artikel folgen in der Reihenfolge des Plans.
      for (const a of offen) {
        ergebnis.set(a, { termin: d, status: fertigBis(a, d) ? "bereit" : "offen" });
        termine.push({ termin: d, nr: a.nr, slug: a.slug, entschieden: false, uebersprungen: [] });
        d = naechsterFreierTermin(d);
      }
      break;
    }
    const i = offen.findIndex((a) => fertigBis(a, d));
    const uebersprungen = (i < 0 ? offen : offen.slice(0, i)).map((a) => ({ nr: a.nr, slug: a.slug }));
    if (i < 0) {
      termine.push({ termin: d, nr: null, slug: null, entschieden: true, uebersprungen });
    } else {
      const [a] = offen.splice(i, 1);
      ergebnis.set(a, { termin: d, status: d <= heute ? "live" : "bereit" });
      termine.push({ termin: d, nr: a.nr, slug: a.slug, entschieden: true, uebersprungen });
    }
    d = naechsterFreierTermin(d);
  }
  return {
    artikel: artikel.map((a) => {
      const { termin, status } = ergebnis.get(a);
      // verschoben: Termin weicht vom geplanten Datum ab (früher oder später)
      const verschoben = a.datum >= seit && termin !== a.datum ? [{ von: a.datum, nach: termin }] : [];
      return { ...a, termin, status, verschoben };
    }),
    termine
  };
}

/**
 * Tatsächlicher Plan zum Zeitpunkt `jetzt`.
 * vorhanden(slug): liegt die Seite des Artikels im Repo (blog/<slug>/index.html aus live.py)?
 * Ergebnis je Artikel: { ...eintrag, termin, status, verschoben: [{ von, nach }] }
 *   status: "live" (erscheint), "bereit" (Termin steht, Datum kommt noch), "offen" (noch nicht fertig, Frist läuft noch)
 */
function zeitplan(plan, optionen = {}) {
  return rechne(plan, optionen).artikel;
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
    .sort((a, b) => a.termin.localeCompare(b.termin) || a.nr - b.nr)
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
const wer = (a) => `Nr. ${a.nr} (${a.slug})`;

/**
 * Was einem Artikel fehlt, damit er bereit ist (für die Mail an Peer).
 * plan.offen: bekannte offene Punkte je Slug (z. B. Bilder mit Menschen), von Hand gepflegt.
 */
function fehlt(plan, a, vorhanden = () => true) {
  const punkte = [];
  const da = vorhanden(a.slug);
  if (!a.bereit) {
    punkte.push(`nicht als bereit eingetragen: aus „FG RealEstate/“ python3 Blogs/design-muster/_build/live.py Website-Redesign/site --bereit ${a.slug}, dann committen und pushen`);
  } else if (!da) {
    punkte.push("als bereit eingetragen, aber die Seite fehlt im Repo (blog/<slug>/index.html und Karte in _data/blogquelle.json): live.py erneut laufen lassen, pushen");
  }
  const bekannt = (plan.offen || {})[a.slug];
  for (const p of [].concat(bekannt || [])) punkte.push(p);
  return punkte;
}

/**
 * Abendprüfung (Update 42 §2.5; seit Update 55 §1.4 Mo und Do 18:00 als Netlify-Funktion).
 * Ergebnis:
 *   morgen: der Termin von morgen oder null, wenn morgen kein Termin im Plan ist
 *     { termin, nr, slug, entschieden, uebersprungen, text }
 *   naechster: der nächste Artikel, dessen Frist noch läuft, oder null
 *     { nr, slug, termin, frist, bereit, fehlt, text }
 *   mail: true, wenn der nächste Artikel nicht bereit ist (dann schreibt die Funktion Peer)
 *   zeilen: alle Texte für den Bericht; die mit „Send this to Jesu“ gehen an Jesu
 */
function abendpruefung(plan, { jetzt = new Date(), vorhanden = () => true } = {}) {
  const morgenTag = plusTage(tag(jetzt), 1);
  const { artikel, termine } = rechne(plan, { jetzt, vorhanden });
  const nachSlug = new Map(artikel.map((a) => [a.slug, a]));
  let morgen = null;
  const t = termine.find((x) => x.termin === morgenTag);
  if (t) {
    let text;
    if (!t.entschieden) {
      const a = nachSlug.get(t.slug);
      text = a.status === "bereit"
        ? `${wer(a)} is ready and goes live with the 06:00 build on ${deutsch(morgenTag)}.`
        : `${wer(a)} is due on ${deutsch(morgenTag)} and not ready yet; deadline 18:00 today.`;
    } else {
      const spaet = t.uebersprungen.map((u) => {
        const a = nachSlug.get(u.slug);
        return `${wer(a)} (now planned: ${deutsch(a.termin)})`;
      });
      const nicht = t.uebersprungen.length === 1 ? "was" : "were";
      if (t.nr === null) {
        text = `Send this to Jesu: ${spaet.join(", ")} ${nicht} not ready by 18:00 on ${deutsch(plusTage(morgenTag, -1))}, and no other article was ready, so ${deutsch(morgenTag)} has no article.`;
      } else if (spaet.length) {
        text = `Send this to Jesu: ${spaet.join(", ")} ${nicht} not ready by 18:00 on ${deutsch(plusTage(morgenTag, -1))}. ${wer(t)} takes ${deutsch(morgenTag)} instead and goes live with the 06:00 build; the late article takes the next date after it is ready.`;
      } else {
        text = `${wer(t)} is ready and goes live with the 06:00 build on ${deutsch(morgenTag)}.`;
      }
    }
    morgen = { ...t, text };
  }
  let naechster = null;
  const n = termine.find((x) => !x.entschieden && x.termin !== morgenTag);
  if (n) {
    const a = nachSlug.get(n.slug);
    const bereit = a.status === "bereit";
    const f = frist(n.termin);
    const punkte = bereit ? [] : fehlt(plan, a, vorhanden);
    const fristText = `${deutsch(plusTage(n.termin, -1))}, 18:00`;
    naechster = {
      nr: a.nr, slug: a.slug, termin: n.termin, frist: f.toISOString(), bereit, fehlt: punkte,
      text: bereit
        ? `Next: ${wer(a)} on ${deutsch(n.termin)} is ready.`
        : `Next: ${wer(a)} on ${deutsch(n.termin)} is not ready yet; deadline ${fristText}.`
    };
  }
  const zeilen = [morgen && morgen.text, naechster && naechster.text].filter(Boolean);
  return { morgen, naechster, mail: Boolean(naechster && !naechster.bereit), zeilen };
}

/** Die nächsten `anzahl` Termine ab heute, für Berichte (Update 55 §1.5). */
function naechsteTermine(plan, { jetzt = new Date(), vorhanden, anzahl = 6 } = {}) {
  const heute = tag(jetzt);
  return zeitplan(plan, { jetzt, vorhanden })
    .filter((a) => a.datum >= plan.automatikSeit && a.termin >= heute)
    .sort((a, b) => a.termin.localeCompare(b.termin))
    .slice(0, anzahl);
}

function ladePlan(repo = path.join(__dirname, "..")) {
  const plan = JSON.parse(fs.readFileSync(path.join(repo, "_data", "blogplan.json"), "utf8"));
  const datei = path.join(repo, "_data", "blogquelle.json");
  const quelle = fs.existsSync(datei) ? JSON.parse(fs.readFileSync(datei, "utf8")) : [];
  const karten = new Set(quelle.map((k) => k.slug));
  const vorhanden = (slug) => karten.has(slug) && fs.existsSync(path.join(repo, "blog", slug, "index.html"));
  return { plan, quelle, vorhanden };
}

module.exports = { tag, inBerlin, frist, istTermin, naechsterFreierTermin, rechne, zeitplan, veroeffentlicht, weiterleitungen, fehlt, abendpruefung, naechsteTermine, jetztAusUmgebung, ladePlan, deutsch };

if (require.main === module) {
  const { plan, vorhanden } = ladePlan();
  const jetzt = jetztAusUmgebung();
  if (process.argv[2] === "abend") {
    const r = abendpruefung(plan, { jetzt, vorhanden });
    if (!r.zeilen.length) console.log(`Kein Artikel am ${deutsch(plusTage(tag(jetzt), 1))}.`);
    for (const z of r.zeilen) console.log(z);
    if (r.naechster) for (const p of r.naechster.fehlt) console.log(`  fehlt: ${p}`);
  } else {
    for (const a of zeitplan(plan, { jetzt, vorhanden }).sort((x, y) => x.termin.localeCompare(y.termin) || x.nr - y.nr)) {
      const weg = a.verschoben.length ? `  (geplant ${a.verschoben.map((v) => v.von).join(", ")})` : "";
      console.log(`${String(a.nr).padStart(2)}  ${deutsch(a.termin)}  ${a.status.padEnd(6)}  ${a.slug}${weg}`);
    }
  }
}
