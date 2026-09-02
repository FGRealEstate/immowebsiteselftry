const fs=require('fs');const path=require('path');
function readDir(name){const dir=path.join(__dirname,'..','content',name);if(!fs.existsSync(dir))return[];return fs.readdirSync(dir).filter(f=>f.endsWith('.json')).sort().map(f=>{try{return JSON.parse(fs.readFileSync(path.join(dir,f),'utf8'));}catch(e){console.warn('[labContent] Fehler in',f,e.message);return null;}}).filter(Boolean)}
function normaliseLocation(location){
  const splitMetric=(value)=>{const [main,...detail]=String(value||'').split(';');return{value:main.trim(),note:detail.join(';').trim()}};
  const price=splitMetric(location.price),rent=splitMetric(location.rent),yieldMetric=splitMetric(location.yield);
  return{...location,priceValue:price.value,priceNote:price.note,rentValue:rent.value,rentNote:rent.note,yieldValue:yieldMetric.value,yieldNote:yieldMetric.note};
}
module.exports=()=>({articles:readDir('wissen'),lexicon:readDir('lexikon'),locations:readDir('standorte').map(normaliseLocation),calculators:readDir('rechner')});
