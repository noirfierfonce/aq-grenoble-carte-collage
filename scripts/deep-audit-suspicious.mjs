import fs from 'node:fs/promises';
const API='https://data.geopf.fr/geocodage/search', CITY='38185';
const pts=JSON.parse(await fs.readFile('data/points.json','utf8'));
const audit=JSON.parse(await fs.readFile('data/geocode-audit-v2.json','utf8'));
const names=new Set(audit.suspicious.map(x=>x.name));
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function clean(a){return a.replace(/,\s*Grenoble,\s*France$/i,'').replace(/N[°º]\s*/gi,'').replace(/\([^)]*\)/g,' ').replace(/\s+/g,' ').trim();}
function variants(p){
  const b=clean(p.address), out=[]; const add=x=>{x=x.replace(/\s+/g,' ').trim();if(x&&!out.includes(x))out.push(x)};
  add(b+', Grenoble');
  for(const s of b.split(/,|\bangle\b|\bface\b|\bvers\b|\bsous\b/i).map(x=>x.trim()).filter(Boolean)) add(s+', Grenoble');
  add(b.replace(/Henri LE CHATELIER/ig,'Henry Le Chatelier')+', Grenoble');
  add(b.replace(/Cours de la LIBERATION/ig,'Cours de la Libération et du Général de Gaulle')+', Grenoble');
  add(b.replace(/Cours BERRIAT/ig,'Cours Berriat')+', Grenoble');
  add(b.replace(/Avenue Alsace LORRAINE/ig,'Avenue Alsace Lorraine')+', Grenoble');
  return out;
}
async function search(q){const u=new URL(API);for(const [k,v] of Object.entries({q,limit:'10',autocomplete:'false',citycode:CITY,lat:'45.1885',lon:'5.7245'}))u.searchParams.set(k,v);const r=await fetch(u,{headers:{'user-agent':'AQ-Grenoble-deep-audit/1.0'}});if(!r.ok)throw new Error('HTTP '+r.status);const d=await r.json();return (d.features||[]).map(f=>({label:f.properties?.label||'',name:f.properties?.name||'',street:f.properties?.street||'',housenumber:f.properties?.housenumber||'',type:f.properties?.type||'',score:f.properties?.score||0,citycode:String(f.properties?.citycode||f.properties?.cityCode||''),lat:f.geometry?.coordinates?.[1],lon:f.geometry?.coordinates?.[0]})).filter(x=>x.citycode===CITY);}
const report=[];
for(const p of pts.filter(x=>names.has(x.name))){const queries=[];for(const q of variants(p)){let results=[];try{results=await search(q);}catch(e){results=[{error:String(e)}]};queries.push({q,results});await sleep(110);}report.push({name:p.name,address:p.address,current:{lat:p.lat,lon:p.lon,label:p.geocodeLabel},queries});console.log(p.name);}
await fs.writeFile('data/geocode-deep-audit.json',JSON.stringify({generatedAt:new Date().toISOString(),count:report.length,points:report},null,2)+'\n');
