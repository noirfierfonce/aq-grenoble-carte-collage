import fs from 'node:fs/promises';
const path='data/points.json';
const pts=JSON.parse(await fs.readFile(path,'utf8'));
const fixes={
  'B – Point 18':{lat:45.180898,lon:5.708859,label:'Rue Docteur Calmette 38000 Grenoble',source:'IGN / Géoplateforme (Grenoble 38185)'},
  'H – Point 01':{lat:45.186385,lon:5.743884,label:'1 Boulevard Clemenceau 38100 Grenoble',source:'IGN / Géoplateforme (Grenoble 38185)'},
  'L – Point 02':{lat:45.16851,lon:5.731581,label:'1 Avenue Marie Reynoard 38100 Grenoble',source:'IGN / Géoplateforme (Grenoble 38185)'}
};
for(const p of pts){const f=fixes[p.name];if(!f)continue;p.lat=f.lat;p.lon=f.lon;p.citycode='38185';p.geocodeLabel=f.label;p.geocodeSource=f.source;console.log('restored',p.name);}
await fs.writeFile(path,JSON.stringify(pts,null,2)+'\n');
const cache=Object.fromEntries(pts.map(p=>[p.address,{lat:p.lat,lon:p.lon,approx:false,fixed:true}]));
await fs.writeFile('geocode-cache-v1.js',`(() => {\n  "use strict";\n  const KEY = "aq-grenoble-geocode-v2";\n  const RESET = "aq-geocode-guard-v2-reset";\n  const FIXED = ${JSON.stringify(cache,null,2)};\n  try { localStorage.setItem(KEY, JSON.stringify(FIXED)); localStorage.setItem(RESET, "1"); } catch (_) {}\n})();\n`);
