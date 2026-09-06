import fs from 'node:fs/promises';

const POINTS_PATH = new URL('../data/points.json', import.meta.url);
const REPORT_PATH = new URL('../data/geocode-audit-v2.json', import.meta.url);
const CITYCODE = '38185';
const API = 'https://data.geopf.fr/geocodage/search';
const CENTER = {lat:45.1885, lon:5.7245};
const BOUNDS={minLat:45.14,maxLat:45.23,minLon:5.67,maxLon:5.79};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const STOP=new Set('rue avenue boulevard bd cours place quai allee esplanade route passage galerie chemin square parc parking face angle sous vers entree ecole groupe scolaire centre sportif tram grenoble france de du des la le les l d et au aux n no'.split(' '));
function cleanAddress(a){return String(a||'').replace(/,\s*38000\s+Grenoble,\s*France$/i,'').replace(/,\s*38100\s+Grenoble,\s*France$/i,'').replace(/,\s*Grenoble,\s*France$/i,'').replace(/N[°º]\s*/gi,'').trim();}
function segments(a){
  const b=cleanAddress(a).replace(/\([^)]*\)/g,' ');
  const parts=b.split(/,|\bangle\b|\bface\b|\bvers\b|\bsous\b/i).map(x=>x.trim()).filter(Boolean);
  return parts;
}
function sig(s){return norm(s).split(' ').filter(t=>t.length>2&&!STOP.has(t)&&!/^[0-9]+(?:bis|ter)?$/.test(t));}
function numberFrom(s){const m=norm(s).match(/\b(\d{1,3})(?:\s*(bis|ter))?\b/); return m?m[1]+(m[2]||''):'';}
function candidateQueries(a){
  const b=cleanAddress(a); const out=[]; const add=q=>{q=String(q||'').replace(/\s+/g,' ').trim();if(q&&!out.includes(q))out.push(q)};
  add(`${b}, Grenoble`);
  const ps=segments(a);
  for(const p of ps) add(`${p}, Grenoble`);
  // variantes sans annotations et avec seulement le premier axe.
  add(`${b.replace(/\([^)]*\)/g,' ').replace(/\b(?:parking|groupe scolaire|ecole|lycee|college|centre sportif)\b.*$/i,'').trim()}, Grenoble`);
  return out;
}
function inGrenoble(lon,lat){return Number.isFinite(lat)&&Number.isFinite(lon)&&lat>=BOUNDS.minLat&&lat<=BOUNDS.maxLat&&lon>=BOUNDS.minLon&&lon<=BOUNDS.maxLon;}
function hav(a,b){const R=6371.0088, p1=a.lat*Math.PI/180,p2=b.lat*Math.PI/180,dp=(b.lat-a.lat)*Math.PI/180,dl=(b.lon-a.lon)*Math.PI/180;const h=Math.sin(dp/2)**2+Math.cos(p1)*Math.cos(p2)*Math.sin(dl/2)**2;return 2*R*Math.asin(Math.sqrt(h));}
async function search(q){
  const u=new URL(API);u.searchParams.set('q',q);u.searchParams.set('limit','10');u.searchParams.set('autocomplete','false');u.searchParams.set('citycode',CITYCODE);u.searchParams.set('lat',String(CENTER.lat));u.searchParams.set('lon',String(CENTER.lon));
  const r=await fetch(u,{headers:{'user-agent':'AQ-Grenoble-geocode-audit/2.0'}});if(!r.ok)throw new Error(`HTTP ${r.status}`);const d=await r.json();return (d.features||[]).map(f=>{const p=f.properties||{}, c=f.geometry?.coordinates||[];return {lat:+c[1],lon:+c[0],citycode:String(p.citycode||p.cityCode||''),label:p.label||p.name||'',street:p.street||p.name||'',type:p.type||'',api:+(p.score||0)};}).filter(x=>x.citycode===CITYCODE&&inGrenoble(x.lon,x.lat));
}
function scoreCandidate(address,query,c){
  const axes=segments(address); const hay=norm(`${c.label} ${c.street}`); let bestAxis=0;
  for(const ax of axes){const toks=sig(ax); if(!toks.length)continue; const hits=toks.filter(t=>hay.includes(t)).length; bestAxis=Math.max(bestAxis,hits/toks.length);}
  const qsig=sig(query), qhit=qsig.length?qsig.filter(t=>hay.includes(t)).length/qsig.length:0;
  const n=numberFrom(query), numberBonus=n&&hay.includes(n)?0.25:0;
  return c.api + bestAxis*2.5 + qhit*0.8 + numberBonus;
}
async function bestCandidate(p){
  let all=[];
  for(const q of candidateQueries(p.address)){
    try{for(const c of await search(q)) all.push({...c,query:q,rank:scoreCandidate(p.address,q,c)});}catch(e){}
    await sleep(90);
  }
  all.sort((a,b)=>b.rank-a.rank);
  // N'accepte que si au moins un nom distinctif d'axe officiel est présent dans le résultat.
  const axes=segments(p.address).map(sig).filter(x=>x.length);
  const acceptable=all.filter(c=>axes.some(toks=>{const h=norm(`${c.label} ${c.street}`);return toks.filter(t=>h.includes(t)).length/Math.max(1,toks.length)>=0.60;}));
  return acceptable[0]||null;
}
const pts=JSON.parse(await fs.readFile(POINTS_PATH,'utf8')); if(pts.length!==209)throw new Error(`209 attendus, ${pts.length}`);
const rows=[];
for(let i=0;i<pts.length;i++){
  const p=pts[i], cand=await bestCandidate(p); const cur={lat:p.lat,lon:p.lon};
  const shift=cand?hav(cur,cand):null;
  rows.push({name:p.name,circuit:p.circuit,address:p.address,current:{lat:p.lat,lon:p.lon,label:p.geocodeLabel||''},candidate:cand?{lat:+cand.lat.toFixed(6),lon:+cand.lon.toFixed(6),label:cand.label,query:cand.query,rank:+cand.rank.toFixed(3)}:null,shiftKm:shift==null?null:+shift.toFixed(3)});
  console.log(`${i+1}/209 ${p.name} shift=${shift==null?'?':shift.toFixed(3)} km`);
}
// voisinage séquentiel dans chaque circuit : mesure utile pour repérer les énormes faux positifs internes à Grenoble.
for(let i=0;i<rows.length;i++){
  const r=rows[i], p=pts[i]; const same=pts.map((x,j)=>({x,j})).filter(z=>z.x.circuit===p.circuit&&Math.abs(z.j-i)<=2&&z.j!==i).map(z=>z.x);
  if(same.length){const avg={lat:same.reduce((s,x)=>s+x.lat,0)/same.length,lon:same.reduce((s,x)=>s+x.lon,0)/same.length};r.neighborDistanceKm=+hav({lat:p.lat,lon:p.lon},avg).toFixed(3);} else r.neighborDistanceKm=null;
  r.suspicious=(r.shiftKm!=null&&r.shiftKm>=0.35)||(r.neighborDistanceKm!=null&&r.neighborDistanceKm>=1.2);
}
const suspicious=rows.filter(r=>r.suspicious).sort((a,b)=>(b.shiftKm||0)-(a.shiftKm||0));
await fs.writeFile(REPORT_PATH,JSON.stringify({generatedAt:new Date().toISOString(),total:209,suspiciousCount:suspicious.length,suspicious,all:rows},null,2)+'\n');
console.log(`Audit terminé : ${suspicious.length} points suspects.`);
