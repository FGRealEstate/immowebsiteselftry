const fs=require('fs');const path=require('path');
function readDir(name){const dir=path.join(__dirname,'..','content',name);if(!fs.existsSync(dir))return[];return fs.readdirSync(dir).filter(f=>f.endsWith('.json')).sort().map(f=>{try{return JSON.parse(fs.readFileSync(path.join(dir,f),'utf8'));}catch(e){console.warn('[labContent] Fehler in',f,e.message);return null;}}).filter(Boolean)}
module.exports=()=>({articles:readDir('wissen'),lexicon:readDir('lexikon'),locations:readDir('standorte'),calculators:readDir('rechner')});
