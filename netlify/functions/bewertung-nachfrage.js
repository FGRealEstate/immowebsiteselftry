const { sendInternalNotification } = require("./_shared/mailer");
const nachfrage = require("./_shared/nachfrage");
const logsafe = require("./_shared/logsafe");
const zustellung = require("./_shared/zustellung");
const PROPSTACK_BASE_URL = require("./_shared/propstack-basis").basis();

/**
 * netlify/functions/bewertung-nachfrage.js (Update 19 §5, 30.10.2026; neu in Update 32 §2, 04.11.2026)
 * Antworten aus Schritt 2 der Bewertung (/immobilienbewertung/nachfrage/, Link aus der Bestätigungsmail, siehe
 * _shared/nachfrage.js).
 *
 * 1. Link prüfen: Kontakt, Objekt, Objektart und Angaben aus Schritt 1 sind signiert (NACHFRAGE_SECRET).
 * 2. Antworten prüfen: alles freiwillig, ein leeres Formular ist gültig; Auswahlwerte nur aus dem Katalog.
 * 3. Notiz (Typ „Aktennotiz“) an Kontakt und Objekt aus Schritt 1, mit allen Angaben unter Sprengnetters Abschnitten.
 *    Jede Einsendung gibt eine neue Notiz mit Datum und Uhrzeit.
 * 4. Objektfelder, die Propstack mit gültigen Werten kennt, per PUT /units/:id; nur nicht leere Werte (Brief §2.6.5).
 *    Schlägt das fehl, ein zweiter Versuch ohne Custom Fields.
 * 5. Rücklesen wie in Update 32 §1 (_shared/zustellung.js). Ist alles da: Mail „Bewertung: Antworten auf die
 *    Nachfrage – Kontakt …“ an das Postfach. Fehlt etwas: Rückfall-Mail mit der vollständigen Notiz.
 * 6. An den Browser nur success und message bzw. error.
 */
exports.handler = async function (event) {
  const requestId = logsafe.requestId(event);
  if (event.httpMethod !== "POST") return zustellung.oeffentlich(405, { success: false, error: "Method not allowed" });

  let data;
  try {
    data = JSON.parse(event.body || "{}");
  } catch {
    return zustellung.oeffentlich(400, { success: false, error: "Ungültige Daten" });
  }

  // Honeypot wie in den anderen Formularen
  if (String(data.company_website || "").trim()) return zustellung.oeffentlich(200, { success: true, message: "Vielen Dank." });

  try {
    const secret = nachfrage.geheimnis(process.env);
    if (!secret) {
      console.error("NACHFRAGE: kein Geheimnis für die Signatur", { requestId });
      return zustellung.oeffentlich(500, { success: false, error: "Die Angaben konnten gerade nicht gesendet werden." });
    }

    const link = await nachfrage.pruefen(secret, data);
    if (!link) return zustellung.oeffentlich(400, { success: false, error: "Der Link ist ungültig. Bitte öffnen Sie den Link aus unserer E-Mail." });

    const fehler = nachfrage.pruefeAntworten(data);
    if (fehler) return zustellung.oeffentlich(400, { success: false, error: fehler });

    const { contactId, propertyId, typ, s1 } = link;
    const zeit = new Date();
    const notiz = nachfrage.notiz({ antworten: data, typ, s1, contactId, propertyId, zeit });
    const felder = propertyId ? nachfrage.propstackFelder({ antworten: data, typ, s1 }) : { property: {}, custom: {} };
    console.log("NACHFRAGE EINGANG:", {
      requestId,
      version: link.version,
      typ: typ || "unbekannt",
      objekt: Boolean(propertyId),
      antworten: nachfrage.KATALOG.filter((f) => String(data[f.key] || "").trim()).length,
      felder: Object.keys(felder.property).length + Object.keys(felder.custom).length,
    });

    const formular = "bewertung-nachfrage";
    const apiKey = process.env.PROPSTACK_API_KEY;
    const api = apiKey ? zustellung.propstack(apiKey, PROPSTACK_BASE_URL) : null;
    const prot = zustellung.protokoll(api, formular, requestId);
    const id = (x) => (/^\d+$/.test(String(x)) ? Number(x) : x);

    // Notiz an Kontakt und Objekt
    let notizId = null;
    if (!api) {
      prot.fehlgeschlagen("Notiz", "/tasks", { name: "PROPSTACK_API_KEY fehlt" });
    } else {
      const noteTypeId = await aktennotizTyp(api);
      const task = {
        title: `Bewertungs-Formular: Angaben des Eigentümers (${nachfrage.zeitText(zeit)})`,
        body: notiz.html,
        client_ids: [id(contactId)],
        ...(propertyId ? { property_ids: [id(propertyId)] } : {}),
        ...(noteTypeId ? { note_type_id: noteTypeId } : {}),
      };
      try {
        const antwort = await api.post("/tasks", { task });
        notizId = await prot.pruefen("Notiz", zustellung.idAus(antwort), { endpoint: "/tasks" });
      } catch (error) {
        prot.fehlgeschlagen("Notiz", "/tasks", error);
      }
    }

    // Objektfelder (nur mit Objekt aus Schritt 1)
    const hatFelder = Object.keys(felder.property).length || Object.keys(felder.custom).length;
    if (api && propertyId && hatFelder) {
      const endpoint = `/units/${propertyId}`;
      const mitCustom = { property: { ...felder.property, ...(Object.keys(felder.custom).length ? { partial_custom_fields: felder.custom } : {}) } };
      let geschrieben = false;
      let letzterFehler = null;
      for (const nutzlast of Object.keys(felder.custom).length && Object.keys(felder.property).length ? [mitCustom, { property: felder.property }] : [mitCustom]) {
        try {
          await api.put(endpoint, nutzlast);
          geschrieben = true;
          break;
        } catch (error) {
          letzterFehler = error;
          console.warn("NACHFRAGE OBJEKT PUT FEHLGESCHLAGEN:", { requestId, status: error.status || "", fehlerart: zustellung.fehlerart(error) });
        }
      }
      if (geschrieben) await prot.pruefen("Objekt", propertyId, { endpoint });
      else prot.fehlgeschlagen("Objekt", endpoint, letzterFehler);
    }

    // Mail an das Postfach: gewohnt oder Rückfall
    const fehlend = prot.fehlend();
    const mail = fehlend.length
      ? await zustellung.rueckfallMail({
          formular,
          requestId,
          text: notiz.text,
          protokoll: prot,
          hinweis: fehlend.some((t) => t.teil === "Objekt") && notizId
            ? "Die Notiz ist am Objekt, die Objektfelder fehlen. Bitte bei Bedarf aus der Notiz übernehmen."
            : "",
        })
      : await sendInternalNotification({ subject: `Bewertung: Antworten auf die Nachfrage – Kontakt ${contactId}`, text: notiz.text });

    if (!notizId && !mail.sent) {
      return zustellung.oeffentlich(502, { success: false, error: "Die Angaben konnten gerade nicht gesendet werden. Bitte versuchen Sie es später noch einmal." });
    }
    // Brief §2.7, wörtlich
    return zustellung.oeffentlich(200, { success: true, message: "Danke, Ihre Angaben sind bei uns angekommen. Wir melden uns wie besprochen bei Ihnen." });
  } catch (error) {
    console.error("NACHFRAGE ERROR:", { requestId, ...logsafe.error(error) });
    return zustellung.oeffentlich(500, { success: false, error: "Die Angaben konnten gerade nicht gesendet werden. Bitte versuchen Sie es später noch einmal." });
  }
};

/** ID des Notiztyps „Aktennotiz“ (im Konto „001 Aktennotiz“); ohne Treffer null (Notiz dann ohne Typ). */
let aktennotizCache = null;
async function aktennotizTyp(api) {
  if (aktennotizCache !== null) return aktennotizCache || null;
  try {
    const daten = await api.get("/note_types");
    const liste = Array.isArray(daten) ? daten : (daten && (daten.data || daten.note_types)) || [];
    const typ = liste.find((t) => t && /aktennotiz/i.test(String(t.name || "")));
    aktennotizCache = typ ? typ.id : 0;
  } catch {
    return null; // nicht merken, beim nächsten Aufruf neu fragen
  }
  return aktennotizCache || null;
}

exports.handler = require("./_shared/formpost").wrap("bewertung-nachfrage", exports.handler);
