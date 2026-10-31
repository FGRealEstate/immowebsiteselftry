const fs=require('fs');const path=require('path');
function readDir(name){const dir=path.join(__dirname,'..','content',name);if(!fs.existsSync(dir))return[];return fs.readdirSync(dir).filter(f=>f.endsWith('.json')).sort().map(f=>{try{return JSON.parse(fs.readFileSync(path.join(dir,f),'utf8'));}catch(e){console.warn('[labContent] Fehler in',f,e.message);return null;}}).filter(Boolean)}
function normaliseLocation(location){
  const splitMetric=(value)=>{const [main,...detail]=String(value||'').split(';');return{value:main.trim(),note:detail.join(';').trim()}};
  // Update 8 §2 (29.10.2026): keine Renditezeile mehr im Lab. Orte mit belegten Werten der Gebietsseite tragen `preis`/`miete` als Objekt {wert,label,quelle,url,stichtag}.
  const price=splitMetric(location.price),rent=splitMetric(location.rent);
  return{...location,priceValue:price.value,priceNote:price.note,rentValue:rent.value,rentNote:rent.note};
}
// Orte mit neuer Gebietsseite (content/gebiete/) bekommen keine alte Standortseite mehr; die Vorlage standort-detail.njk baut nur legacyLocations.
// `ersetzt` in einer Gebietsseite nennt alte Standortseiten, die per 301 auf sie zeigen (Eintrag in _redirects), z. B. velten → oberhavel.
// Diese Orte fallen ganz aus locations heraus, damit Übersicht und Investment Lab nicht auf die Weiterleitung verlinken.
function gebieteSlugs(){return new Set(readDir('gebiete').map(g=>g.slug))}
function ersetzteSlugs(){return new Set(readDir('gebiete').flatMap(g=>g.ersetzt||[]))}
// Ausgebaute Lexikon-Einträge (Update 4, 2.13): Jede Fußnote [[n]] braucht die Quelle n, jede Quelle wird zitiert; sonst bricht der Build ab.
function pruefeAusbau(e){const a=e.ausbau;if(!a)return e;const n=(a.quellen||[]).length,genutzt=new Set();for(const t of [...a.einordnung,...a.beispiel,...a.abschnitte.flatMap(x=>x.absaetze)])for(const m of t.matchAll(/\[\[(\d+(?:\s*,\s*\d+)*)\]\]/g))for(const z of m[1].split(','))genutzt.add(+z);for(const z of genutzt)if(z<1||z>n)throw new Error(`[labContent] Lexikon ${e.slug}: Fußnote [[${z}]] ohne Quelle (${n} Quellen)`);for(let z=1;z<=n;z++)if(!genutzt.has(z))throw new Error(`[labContent] Lexikon ${e.slug}: Quelle ${z} wird nicht zitiert`);return e}
module.exports=()=>{const weg=ersetzteSlugs();const locations=readDir('standorte').filter(l=>!weg.has(l.slug)).map(normaliseLocation);const neu=gebieteSlugs();return{articles:readDir('wissen'),lexicon:readDir('lexikon').map(pruefeAusbau),locations,legacyLocations:locations.filter(l=>!neu.has(l.slug)),calculators:readDir('rechner')}};
