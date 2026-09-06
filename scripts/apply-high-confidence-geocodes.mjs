import fs from 'node:fs/promises';

const pts=JSON.parse(await fs.readFile('data/points.json','utf8'));
const osm=JSON.parse(await fs.readFile('data/osm-audit-suspicious.json','utf8'));
const ign=JSON.parse(await fs.readFile('data/geocode-audit-v2.json','utf8'));
const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const STOP=new Set('rue avenue boulevard bd cours place quai allee esplanade route passage galerie chemin square de du des la le les et au aux'.split(' '));
function primary(address){return String(address).replace(/,\s*Grenoble,\s*France$/i,'').replace(/\([^)]*\)/g,' ').split(/,|\bangle\b|\bface\b|\bvers\b|\bsous\b/i)[0].trim();}
function house(seg){const m=seg.match(/N[°º]?\s*(\d{1,3})\s*(bis|ter)?|\b(\d{1,3})\s*(bis|ter)?\b/i);return m?String(m[1]||m[3])+(m[2]||m[4]||'').toLowerCase():'';}
function roadTokens(seg){return norm(seg.replace(/N[°º]?\s*\d{1,3}\s*(?:bis|ter)?/ig,' ').replace(/\b\d{1,3}\s*(?:bis|ter)?\b/ig,' ')).split(' ').filter(t=>t.length>2&&!STOP.has(t));}
function roadMatch(seg,road){const toks=roadTokens(seg), h=norm(road); return toks.length>0 && toks.filter(t=>h.includes(t)).length/toks.length>=0.7;}
function hnorm(x){return norm(x).replace(/\s+/g,'');}
const osmBy=new Map(osm.points.map(x=>[x.name,x]));
const ignBy=new Map(ign.suspicious.map(x=>[x.name,x]));
const changed=[];
for(const p of pts){
  const op=osmBy.get(p.name); if(!op) continue;
  const seg=primary(p.address), hn=house(seg);
  let choices=[];
  for(const q of op.queries||[]) for(const r of q.results||[]){
    if(r?.error||!Number.isFinite(r?.lat)||!Number.isFinite(r?.lon)) continue;
    const a=r.address||{}, rh=String(a.house_number||'').toLowerCase().replace(/\s+/g,''), road=a.road||'';
    if(hn && rh===hn.replace(/\s+/g,'') && roadMatch(seg,road)) choices.push(r);
  }
  // dédoublonnage spatial.
  choices=choices.filter((r,i,a)=>a.findIndex(x=>Math.abs(x.lat-r.lat)<1e-6&&Math.abs(x.lon-r.lon)<1e-6)===i);
  let chosen=choices[0]||null, reason='OSM exact numéro + voie';
  if(!chosen){
    const ia=ignBy.get(p.name);
    const cand=ia?.candidate;
    const currentLabel=ia?.current?.label||p.geocodeLabel||'';
    // Repli uniquement pour les erreurs manifestes : déplacement > 1 km et candidat IGN sur la voie principale, alors que le libellé actuel ne correspond pas à cette voie.
    if(cand && ia.shiftKm>=1 && roadMatch(seg,cand.label) && !roadMatch(seg,currentLabel)){
      chosen={lat:cand.lat,lon:cand.lon,display_name:cand.label}; reason='IGN voie principale, erreur actuelle manifeste >1 km';
    }
  }
  if(!chosen) continue;
  const dist=Math.hypot((p.lat-chosen.lat)*111,(p.lon-chosen.lon)*78.5);
  if(dist<0.03) continue;
  const before={lat:p.lat,lon:p.lon,label:p.geocodeLabel||''};
  p.lat=+chosen.lat.toFixed(6);p.lon=+chosen.lon.toFixed(6);p.citycode='38185';p.geocodeLabel=chosen.display_name||chosen.label||'';p.geocodeSource=reason.startsWith('OSM')?'OpenStreetMap / Nominatim (vérifié IGN)':'IGN / Géoplateforme (audit renforcé)';
  changed.push({name:p.name,address:p.address,before,after:{lat:p.lat,lon:p.lon,label:p.geocodeLabel},reason,shiftKm:+dist.toFixed(3)});
}
if(!changed.length) throw new Error('Aucune correction à haute confiance trouvée.');
await fs.writeFile('data/points.json',JSON.stringify(pts,null,2)+'\n');
await fs.writeFile('data/geocode-corrections-v2.json',JSON.stringify({generatedAt:new Date().toISOString(),count:changed.length,changes:changed},null,2)+'\n');
const cache=Object.fromEntries(pts.map(p=>[p.address,{lat:p.lat,lon:p.lon,approx:false,fixed:true}]));
const cacheJs=`(() => {\n  "use strict";\n  const KEY = "aq-grenoble-geocode-v2";\n  const RESET = "aq-geocode-guard-v2-reset";\n  const FIXED = ${JSON.stringify(cache,null,2)};\n  try { localStorage.setItem(KEY, JSON.stringify(FIXED)); localStorage.setItem(RESET, "1"); } catch (_) {}\n})();\n`;
await fs.writeFile('geocode-cache-v1.js',cacheJs);
console.log(`Corrections haute confiance appliquées: ${changed.length}`);for(const c of changed)console.log(c.name,c.shiftKm,c.reason);
