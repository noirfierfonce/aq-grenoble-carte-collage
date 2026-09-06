import fs from 'node:fs/promises';
const pts=JSON.parse(await fs.readFile('data/points.json','utf8'));
if(pts.length!==209) throw new Error(`209 attendus, ${pts.length}`);
for(const p of pts){if(p.citycode!=='38185'||!Number.isFinite(p.lat)||!Number.isFinite(p.lon))throw new Error(`Coordonnée invalide ${p.name}`);}
const letters=[...'ABCDEFGHIJKLM'];
const R=6371.0088, lat0=pts.reduce((s,p)=>s+p.lat,0)/pts.length;
for(const p of pts){p.x=R*Math.cos(lat0*Math.PI/180)*p.lon*Math.PI/180;p.y=R*p.lat*Math.PI/180;}
const d=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const byName=new Map(pts.map(p=>[p.name,p]));
function groups(assign){const g=Object.fromEntries(letters.map(c=>[c,[]]));for(const p of pts)g[assign[p.name]].push(p);return g;}
function centroid(q){return {x:q.reduce((s,p)=>s+p.x,0)/q.length,y:q.reduce((s,p)=>s+p.y,0)/q.length};}
function distCent(p,c){return Math.hypot(p.x-c.x,p.y-c.y);}
function routeLength(q){
  if(q.length<2)return 0;
  // Longueur d'une tournée terrain approximative par plus proche voisin, meilleur départ parmi tous les points.
  let best=Infinity;
  for(const start of q){let cur=start, unseen=new Set(q.filter(x=>x!==start)), total=0;while(unseen.size){let n=null,nd=Infinity;for(const x of unseen){const z=d(cur,x);if(z<nd){nd=z;n=x;}}total+=nd;cur=n;unseen.delete(n);}best=Math.min(best,total);}
  return best;
}
function metrics(assign){
 const g=groups(assign), per={}, centers={};let sse=0,totalRoute=0,maxRadius=0;
 for(const c of letters){const q=g[c],ctr=centroid(q);centers[c]=ctr;const ds=q.map(p=>distCent(p,ctr));const route=routeLength(q);per[c]={n:q.length,mean:ds.reduce((a,b)=>a+b,0)/q.length,max:Math.max(...ds),route};sse+=ds.reduce((a,z)=>a+z*z,0);totalRoute+=route;maxRadius=Math.max(maxRadius,...ds);}
 return {per,centers,sse,totalRoute,maxRadius};
}
const current=Object.fromEntries(pts.map(p=>[p.name,p.circuit]));
const currentM=metrics(current);
// Optimisation conservatrice : 13 à 19 points, pénalité pour chaque changement afin d'éviter un remaniement gratuit.
let a={...current};
const MIN=13,MAX=19,CHANGE_PENALTY=0.08;
function objective(assign){const m=metrics(assign);let penalty=0;for(const p of pts)if(assign[p.name]!==p.circuit)penalty+=CHANGE_PENALTY;for(const c of letters){const n=m.per[c].n;if(n<MIN)penalty+=(MIN-n)**2*5;if(n>MAX)penalty+=(n-MAX)**2*5;}return m.sse+penalty;}
let best=objective(a);
for(let iter=0;iter<120;iter++){
 const m=metrics(a), sizes=Object.fromEntries(letters.map(c=>[c,m.per[c].n]));let win=null;
 for(const p of pts){const from=a[p.name];for(const to of letters){if(to===from||sizes[to]>=MAX)continue;if(sizes[from]<=MIN)continue;const old=distCent(p,m.centers[from]), neu=distCent(p,m.centers[to]);if(neu>old+0.6)continue;const h={...a,[p.name]:to};const s=objective(h);if(!win||s<win.s)win={s,name:p.name,to};}}
 if(!win||win.s>=best-1e-9)break;a[win.name]=win.to;best=win.s;
}
// Échanges 1-pour-1 sur circuits proches.
for(let iter=0;iter<80;iter++){
 const m=metrics(a),g=groups(a);let win=null;
 for(let i=0;i<letters.length;i++)for(let j=i+1;j<letters.length;j++){
  const ca=letters[i],cb=letters[j];if(Math.hypot(m.centers[ca].x-m.centers[cb].x,m.centers[ca].y-m.centers[cb].y)>3.0)continue;
  const qa=[...g[ca]].sort((p,q)=>(distCent(p,m.centers[cb])-distCent(p,m.centers[ca]))-(distCent(q,m.centers[cb])-distCent(q,m.centers[ca]))).slice(0,5);
  const qb=[...g[cb]].sort((p,q)=>(distCent(p,m.centers[ca])-distCent(p,m.centers[cb]))-(distCent(q,m.centers[ca])-distCent(q,m.centers[cb]))).slice(0,5);
  for(const pa of qa)for(const pb of qb){const h={...a,[pa.name]:cb,[pb.name]:ca};const s=objective(h);if(!win||s<win.s)win={s,pa:pa.name,pb:pb.name,ca,cb};}
 }
 if(!win||win.s>=best-1e-9)break;a[win.pa]=win.cb;a[win.pb]=win.ca;best=win.s;
}
const proposedM=metrics(a);
const moves=pts.filter(p=>a[p.name]!==p.circuit).map(p=>{const old=distCent(p,currentM.centers[p.circuit]);const neu=distCent(p,proposedM.centers[a[p.name]]);return {name:p.name,address:p.address,from:p.circuit,to:a[p.name],gain:old-neu,old,new:neu};}).sort((x,y)=>y.gain-x.gain);
const anomalies=[];
for(const p of pts){const own=distCent(p,currentM.centers[p.circuit]);let bestOther=null;for(const c of letters){if(c===p.circuit)continue;const z=distCent(p,currentM.centers[c]);if(!bestOther||z<bestOther.d)bestOther={c,d:z};}if(own-bestOther.d>=0.30)anomalies.push({name:p.name,address:p.address,current:p.circuit,closest:bestOther.c,gap:own-bestOther.d,own,other:bestOther.d});}
anomalies.sort((x,y)=>y.gap-x.gap);
const pct=(a,b)=>b?100*(b-a)/b:0;
let out=[];
out.push('# Analyse finale de regroupement des circuits A–M','',`Base : **209 points**, tous enregistrés avec citycode **38185 (Grenoble)**.`,'','## Résumé','',`- Changements proposés : **${moves.length}**.`,`- Compacité (somme des distances² aux centres) : **${currentM.sse.toFixed(2)} → ${proposedM.sse.toFixed(2)} km²**, amélioration **${pct(proposedM.sse,currentM.sse).toFixed(1)} %**.`,`- Tournées terrain approximatives (plus proche voisin, sans retour au départ) : **${currentM.totalRoute.toFixed(1)} → ${proposedM.totalRoute.toFixed(1)} km**, variation **${pct(proposedM.totalRoute,currentM.totalRoute).toFixed(1)} %**.`,`- Rayon maximal d’un circuit : **${currentM.maxRadius.toFixed(2)} → ${proposedM.maxRadius.toFixed(2)} km**.`,'','## Par circuit','', '|Circuit|Points actuels|Points proposés|Distance moy. actuelle|Distance moy. proposée|Rayon max actuel|Rayon max proposé|Tournée actuelle|Tournée proposée|','|---|---:|---:|---:|---:|---:|---:|---:|---:|');
for(const c of letters){const x=currentM.per[c],y=proposedM.per[c];out.push(`|${c}|${x.n}|${y.n}|${x.mean.toFixed(2)} km|${y.mean.toFixed(2)} km|${x.max.toFixed(2)} km|${y.max.toFixed(2)} km|${x.route.toFixed(2)} km|${y.route.toFixed(2)} km|`);}
out.push('','## Réaffectations proposées','', '|Point|De|Vers|Gain de proximité au centre|Adresse|','|---|---:|---:|---:|---|');
for(const m of moves)out.push(`|${m.name}|${m.from}|${m.to}|${m.gain.toFixed(2)} km|${m.address}|`);
out.push('','## Points atypiques dans l’organisation actuelle','', '|Point|Circuit actuel|Circuit géographiquement plus proche|Écart|Adresse|','|---|---:|---:|---:|---|');for(const z of anomalies)out.push(`|${z.name}|${z.current}|${z.closest}|${z.gap.toFixed(2)} km|${z.address}|`);
out.push('','## Méthode','', 'Optimisation géographique conservatrice sur coordonnées fixes : centroïdes locaux, contrainte de 13 à 19 points par circuit, pénalité pour limiter les changements, puis contrôle par longueur de tournée approximative. **Ce rapport ne modifie aucune affectation de circuit.**');
await fs.mkdir('analysis',{recursive:true});await fs.writeFile('analysis/circuit-distance-report-v2.md',out.join('\n')+'\n');
await fs.writeFile('analysis/circuit-proposal-v2.json',JSON.stringify({generatedAt:new Date().toISOString(),summary:{moves:moves.length,currentSse:currentM.sse,proposedSse:proposedM.sse,currentRoute:currentM.totalRoute,proposedRoute:proposedM.totalRoute},moves,assignment:a},null,2)+'\n');
console.log(`moves=${moves.length} sse=${currentM.sse.toFixed(2)}->${proposedM.sse.toFixed(2)} route=${currentM.totalRoute.toFixed(1)}->${proposedM.totalRoute.toFixed(1)}`);
