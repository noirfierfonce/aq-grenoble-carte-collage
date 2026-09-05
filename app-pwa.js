(() => {
  "use strict";

  const CIRCUITS = {
    A:{zone:"Gare / Europole / Berriat",count:18},B:{zone:"Saint-Bruno / Chorier / Drac / Vallier",count:19},C:{zone:"Île Verte / Jean-Pain / Chavant",count:18},D:{zone:"Centre / Notre-Dame / Saint-Laurent",count:20},E:{zone:"Victor-Hugo / Championnet / Jaurès",count:19},F:{zone:"Vallier / Eaux-Claires / Rhin-et-Danube",count:18},G:{zone:"Bachelard / Libération / Louise-Michel",count:13},H:{zone:"Clemenceau / Jean-Perrot / MC2",count:10},I:{zone:"Alliés / Stalingrad / Foch",count:17},J:{zone:"Clemenceau / Abbaye / Jouhaux",count:16},K:{zone:"Teisseire / Malherbe / MC2",count:15},L:{zone:"Malherbe / Village Olympique / Prémol",count:13},M:{zone:"Arlequin / Géants / Europe",count:13}
  };
  const STATUS_OPTIONS = [
    {value:"todo",label:"À faire",icon:"○"},
    {value:"done",label:"Fait",icon:"✓"},
    {value:"vandalized",label:"Vandalisé",icon:"!"},
    {value:"covered",label:"Recouvert",icon:"↻"}
  ];
  const GENERAL = "ALL";
  const GRENOBLE = [45.1885,5.7245];
  const BOUNDS = {minLat:45.08,maxLat:45.30,minLon:5.55,maxLon:5.95};
  const CACHE_KEY = "aq-grenoble-geocode-v2";
  const TRACKING_KEY = "aq-grenoble-shared-cache-v1";
  const OLD_TRACKING_KEY = "aq-grenoble-tracking-v1";
  const QUEUE_KEY = "aq-grenoble-sync-queue-v1";
  const ACCESS_KEY = "aq-grenoble-access-v1";
  const config = window.AQ_APP_CONFIG || {apiUrl:""};

  const state = {
    points:[],
    circuit:getInitialCircuit(),
    markers:new Map(),
    geocode:loadJson(CACHE_KEY,{}),
    tracking:loadInitialTracking(),
    queue:loadJson(QUEUE_KEY,[]),
    accessCode:sessionStorage.getItem(ACCESS_KEY) || "",
    renderToken:0,
    deferredInstall:null,
    snapshotBusy:false
  };

  const map = L.map("map",{zoomControl:true,attributionControl:true}).setView(GRENOBLE,13);
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19,attribution:"&copy; OpenStreetMap contributors"}).addTo(map);
  const markerLayer = L.layerGroup().addTo(map);

  document.addEventListener("DOMContentLoaded", init);

  async function init(){
    buildCircuitNav();
    bindControls();
    setupPwa();
    updateSyncChip();
    try{
      const response = await fetch("./data/points.json",{cache:"no-store"});
      if(!response.ok) throw new Error("Données indisponibles.");
      state.points = await response.json();
      await showCircuit(state.circuit);
      updateDashboard();
      if(config.apiUrl){
        if(!state.accessCode) showAccessModal();
        else await syncNow();
      }
    }catch(error){
      setLoading("Impossible de charger les points. Réessaie dans quelques instants.");
      console.error(error);
    }
    window.addEventListener("online",()=>{updateSyncChip();flushQueue();});
    window.addEventListener("offline",updateSyncChip);
  }

  function loadInitialTracking(){
    const current = loadJson(TRACKING_KEY,null);
    if(current) return current;
    const legacy = loadJson(OLD_TRACKING_KEY,{});
    if(Object.keys(legacy).length) saveJson(TRACKING_KEY,legacy);
    return legacy;
  }

  function getInitialCircuit(){
    const requested = new URLSearchParams(location.search).get("c");
    const normalized = (requested || GENERAL).toUpperCase();
    return normalized === GENERAL || CIRCUITS[normalized] ? normalized : GENERAL;
  }

  function buildCircuitNav(){
    const nav = document.getElementById("circuitNav");
    nav.replaceChildren();
    addCircuitButton(GENERAL,"◎","Tous");
    Object.keys(CIRCUITS).forEach(letter=>addCircuitButton(letter,letter,`Circuit ${letter}`));
  }

  function addCircuitButton(value,letter,label){
    const button = document.createElement("button");
    button.type="button";
    button.className="circuit-btn";
    button.dataset.circuit=value;
    button.innerHTML=`<span class="circuit-letter">${letter}</span><span class="circuit-label">${label}</span>`;
    button.addEventListener("click",()=>showCircuit(value));
    document.getElementById("circuitNav").appendChild(button);
  }

  function bindControls(){
    document.getElementById("locateBtn").addEventListener("click",locateUser);
    document.getElementById("shareBtn").addEventListener("click",shareCurrentCircuit);
    document.getElementById("accessForm").addEventListener("submit",async event=>{
      event.preventDefault();
      const value = document.getElementById("accessInput").value.trim();
      if(!value) return;
      state.accessCode=value;
      sessionStorage.setItem(ACCESS_KEY,value);
      document.getElementById("accessModal").hidden=true;
      await syncNow(true);
    });
  }

  function setupPwa(){
    if("serviceWorker" in navigator){
      navigator.serviceWorker.register("./sw-v2.js").catch(console.warn);
    }
    window.addEventListener("beforeinstallprompt",event=>{
      event.preventDefault();
      state.deferredInstall=event;
      const btn=document.getElementById("installBtn");
      btn.hidden=false;
      btn.onclick=async()=>{
        if(!state.deferredInstall) return;
        state.deferredInstall.prompt();
        await state.deferredInstall.userChoice;
        state.deferredInstall=null;
        btn.hidden=true;
      };
    });
    window.addEventListener("appinstalled",()=>{document.getElementById("installBtn").hidden=true;});
  }

  async function showCircuit(letter){
    if(letter!==GENERAL&&!CIRCUITS[letter]) return;
    state.circuit=letter;
    state.renderToken+=1;
    const token=state.renderToken;
    const url=new URL(location.href);url.searchParams.set("c",letter);history.replaceState(null,"",url);
    document.querySelectorAll(".circuit-btn").forEach(btn=>{
      const active=btn.dataset.circuit===letter;
      btn.setAttribute("aria-current",active?"true":"false");
      if(active) btn.scrollIntoView({behavior:"smooth",block:"nearest",inline:"center"});
    });
    const points=letter===GENERAL?state.points:state.points.filter(p=>p.circuit===letter);
    updateHeader(letter,points);
    markerLayer.clearLayers();state.markers.clear();map.setView(GRENOBLE,letter===GENERAL?12:13);
    if(letter===GENERAL) renderGeneralOverview(); else renderList(points);
    const cached=points.filter(point=>state.geocode[point.address]);
    cached.forEach((point,index)=>{
      const pos=state.geocode[point.address];
      addMarker(point,pos.lat,pos.lon,letter===GENERAL?point.circuit:index+1,pos.approx);
      if(letter!==GENERAL) updateCardGeocode(point.name,pos.approx?"Repère approximatif.":"Repère chargé.");
    });
    fitToCurrentMarkers();
    const missing=points.filter(point=>!state.geocode[point.address]);
    if(!missing.length){setLoading("");return;}
    if(!navigator.onLine){setLoading("Hors ligne · adresses et suivi restent disponibles.");return;}
    if(letter===GENERAL) await geocodeGeneral(missing,token,points.length,cached.length);
    else await geocodeCircuit(missing,token,points,cached.length);
    if(token===state.renderToken) setLoading("");
  }

  function updateHeader(letter,points){
    const general=letter===GENERAL;
    document.getElementById("subtitle").textContent=general?"Vue générale · 209 points · 13 circuits.":`Circuit ${letter} · ${CIRCUITS[letter].zone}.`;
    document.getElementById("circuitBadge").textContent=general?"Carte générale.":`Circuit ${letter}.`;
    document.getElementById("zoneTitle").textContent=general?"Grenoble · tous les circuits.":CIRCUITS[letter].zone;
    document.getElementById("count").textContent=`${points.length} points.`;
    document.getElementById("shareBtn").textContent=general?"↗ Partager.":`↗ Circuit ${letter}.`;
    document.querySelector(".hint").textContent=general?"Vue d’ensemble. Ouvre un circuit pour le suivi terrain détaillé.":"Ouvre l’itinéraire, indique l’état du point et sa capacité lors du repérage.";
    updateProgress(points);
    updateCircuitMini(letter,points);
    document.title=general?"Collage AQ Grenoble":`Circuit ${letter} · Collage AQ Grenoble`;
  }

  function updateProgress(points){
    const done=points.filter(p=>getTracking(p).status==="done").length;
    const remaining=points.length-done;
    const percent=points.length?Math.round(done/points.length*100):0;
    document.getElementById("progress").innerHTML=`<div class="progress-top"><strong>${done} / ${points.length} faits.</strong><span>${remaining} à traiter.</span></div><div class="progress-bar"><span style="width:${percent}%"></span></div>`;
  }

  function updateCircuitMini(letter,points){
    const host=document.getElementById("circuitMini");
    if(letter===GENERAL){host.innerHTML="";return;}
    const stock=stockFor(points);
    const recoller=points.filter(p=>["vandalized","covered"].includes(getTracking(p).status)).length;
    host.innerHTML=`<div class="mini-pill"><strong>${stock.color} couleur · ${stock.bw} N&B</strong><span>stock à préparer.</span></div><div class="mini-pill"><strong>${recoller} à recoller</strong><span>signalés sur ce circuit.</span></div>`;
  }

  function renderGeneralOverview(){
    const list=document.getElementById("pointList");list.replaceChildren();
    const wrap=document.createElement("div");wrap.className="general-grid";
    Object.entries(CIRCUITS).forEach(([letter,info])=>{
      const points=state.points.filter(p=>p.circuit===letter);
      const done=points.filter(p=>getTracking(p).status==="done").length;
      const recoller=points.filter(p=>["vandalized","covered"].includes(getTracking(p).status)).length;
      const stock=stockFor(points);
      const card=document.createElement("section");card.className="general-card";
      card.innerHTML=`<div class="general-card-top"><div><h3>Circuit ${letter} · ${info.zone}</h3><div class="meta">${info.count} points.</div></div><span class="badge">${done}/${info.count} faits</span></div><div class="general-stats"><div class="general-stat"><strong>${stock.color}+${stock.bw}</strong><span>stock C + N&B</span></div><div class="general-stat"><strong>${info.count-done}</strong><span>à traiter</span></div><div class="general-stat"><strong>${recoller}</strong><span>à recoller</span></div></div>`;
      const actions=document.createElement("div");actions.className="general-actions";
      const open=document.createElement("button");open.className="primary";open.textContent=`Ouvrir le circuit ${letter}.`;open.onclick=()=>showCircuit(letter);
      const share=document.createElement("button");share.textContent="Copier le lien.";share.onclick=()=>copyCircuitLink(letter);
      actions.append(open,share);card.append(actions);wrap.append(card);
    });
    list.append(wrap);
  }

  function renderList(points){
    const list=document.getElementById("pointList");list.replaceChildren();
    points.forEach((point,index)=>{
      const tracking=getTracking(point);
      const li=document.createElement("li");li.className=`point-card status-${tracking.status}`;li.dataset.point=point.name;
      const top=document.createElement("div");top.className="point-top";
      const name=document.createElement("div");name.className="point-name";name.textContent=`${index+1}. ${point.name}`;
      const poster=document.createElement("span");poster.className=`poster ${point.poster.includes("Couleur")?"color":"bw"}`;poster.textContent=point.poster;top.append(name,poster);
      const address=document.createElement("p");address.className="address";address.textContent=point.address;
      const actions=document.createElement("div");actions.className="card-actions";
      const route=document.createElement("a");route.className="primary";route.target="_blank";route.rel="noopener noreferrer";route.href=googleDirectionsUrl(point.address);route.innerHTML='<span class="action-icon">↗</span><span>Itinéraire.</span>';
      const zoom=document.createElement("button");zoom.type="button";zoom.innerHTML='<span class="action-icon">⌖</span><span>Voir sur la carte.</span>';zoom.onclick=()=>focusPoint(point.name);actions.append(route,zoom);
      const tracker=document.createElement("div");tracker.className="tracker-box";
      const statusTitle=document.createElement("div");statusTitle.className="tracker-title";statusTitle.innerHTML='<strong>État du point.</strong><span>Choisis une case.</span>';
      const statusGrid=document.createElement("div");statusGrid.className="status-grid";
      STATUS_OPTIONS.forEach(option=>{
        const b=document.createElement("button");b.type="button";b.className=`status-btn status-choice-${option.value}`;b.dataset.value=option.value;b.setAttribute("aria-pressed",tracking.status===option.value?"true":"false");b.innerHTML=`<span class="status-icon">${option.icon}</span><span>${option.label}.</span>`;b.onclick=()=>setPointStatus(point,option.value);statusGrid.append(b);
      });
      const capacity=document.createElement("div");capacity.className="capacity-block";capacity.innerHTML='<div class="tracker-title"><strong>Capacité constatée.</strong><span>Affiches A3 possibles.</span></div>';
      const capacityGrid=document.createElement("div");capacityGrid.className="capacity-grid";
      [1,2,3,4].forEach(value=>{const b=document.createElement("button");b.type="button";b.className="capacity-btn";b.dataset.capacity=String(value);b.setAttribute("aria-pressed",tracking.capacity===value?"true":"false");b.innerHTML=`<strong>${value}</strong><span>affiche${value>1?"s":""}</span>`;b.onclick=()=>setPointCapacity(point,value);capacityGrid.append(b);});
      capacity.append(capacityGrid);
      const save=document.createElement("div");save.className="save-state";save.dataset.saveFor=trackingId(point);updateSaveStateElement(save,point);
      tracker.append(statusTitle,statusGrid,capacity,save);
      const geo=document.createElement("div");geo.className="geocode-status";geo.dataset.statusFor=point.name;geo.textContent=state.geocode[point.address]?"Repère chargé.":"Placement du repère en cours.";
      li.append(top,address,actions,tracker,geo);list.append(li);
    });
  }

  function trackingId(point){return `${point.circuit}|${point.name}`;}
  function getTracking(point){return {status:"todo",capacity:null,...(state.tracking[trackingId(point)]||{})};}

  function setPointStatus(point,status){
    const current=getTracking(point);if(current.status===status)return;
    applyMutation(point,{status,capacity:current.capacity});
  }
  function setPointCapacity(point,capacity){
    const current=getTracking(point);if(current.capacity===capacity)return;
    applyMutation(point,{status:current.status,capacity});
  }

  function applyMutation(point,next){
    const id=trackingId(point);
    state.tracking[id]={...getTracking(point),...next,updatedAt:new Date().toISOString()};
    saveJson(TRACKING_KEY,state.tracking);
    const mutation={id,mutationId:`${Date.now()}-${Math.random().toString(36).slice(2,8)}`,circuit:point.circuit,name:point.name,address:point.address,status:state.tracking[id].status,capacity:state.tracking[id].capacity,createdAt:Date.now()};
    state.queue=state.queue.filter(item=>item.id!==id);
    state.queue.push(mutation);saveJson(QUEUE_KEY,state.queue);
    refreshPoint(point);updateDashboard();updateSyncChip();flushQueue();
  }

  function refreshPoint(point){
    if(state.circuit===GENERAL){renderGeneralOverview();updateProgress(state.points);return;}
    const card=document.querySelector(`[data-point="${cssEscape(point.name)}"]`);if(!card)return;
    const tracking=getTracking(point);
    STATUS_OPTIONS.forEach(o=>card.querySelector(`.status-btn[data-value="${o.value}"]`)?.setAttribute("aria-pressed",tracking.status===o.value?"true":"false"));
    card.querySelectorAll(".capacity-btn").forEach(btn=>btn.setAttribute("aria-pressed",Number(btn.dataset.capacity)===tracking.capacity?"true":"false"));
    card.className=`point-card status-${tracking.status}${card.classList.contains("is-active")?" is-active":""}`;
    updateSaveStateElement(card.querySelector(".save-state"),point);
    const points=state.points.filter(p=>p.circuit===state.circuit);updateProgress(points);updateCircuitMini(state.circuit,points);
    const marker=state.markers.get(point.name);if(marker){const pos=marker.getLatLng();marker.setIcon(markerIcon(point,pos));}
  }

  function updateSaveStateElement(el,point){
    if(!el)return;
    const pending=state.queue.some(item=>item.id===trackingId(point));
    el.className=`save-state ${pending?"pending":"synced"}`;
    el.textContent=pending?(navigator.onLine?"Modification en cours de synchronisation.":"Hors ligne · modification gardée en attente."):(config.apiUrl?"Synchronisé avec le suivi collectif.":"Mode local · backend à brancher.");
  }

  function updateDashboard(){
    const stock=stockFor(state.points);
    const done=state.points.filter(p=>getTracking(p).status==="done").length;
    const recoller=state.points.filter(p=>["vandalized","covered"].includes(getTracking(p).status)).length;
    const verified=state.points.filter(p=>Number(getTracking(p).capacity)>=1).length;
    document.getElementById("statStock").textContent=`${stock.color} + ${stock.bw}`;
    document.getElementById("statStockMeta").textContent="couleur + N&B à préparer.";
    document.getElementById("statDone").textContent=`${done} / ${state.points.length||209}`;
    document.getElementById("statRecoller").textContent=String(recoller);
    document.getElementById("statVerified").textContent=`${verified} / ${state.points.length||209}`;
  }

  function stockFor(points){
    let color=0,bw=0;
    points.forEach(point=>{
      const t=getTracking(point);if(t.status==="done")return;
      const qty=Number(t.capacity)||1;
      if(point.poster.includes("Couleur"))color+=qty;else bw+=qty;
    });
    return {color,bw,total:color+bw};
  }

  async function syncNow(force=false){
    if(!config.apiUrl||!navigator.onLine||state.snapshotBusy)return;
    if(!state.accessCode){showAccessModal();return;}
    state.snapshotBusy=true;updateSyncChip();
    try{
      const remote=await jsonp(`${config.apiUrl}?action=snapshot&key=${encodeURIComponent(state.accessCode)}`);
      if(!remote||!remote.ok){if(force)showAccessModal(remote?.error||"Code incorrect.");throw new Error(remote?.error||"Snapshot impossible.");}
      reconcileRemote(remote.tracking||{});
      await flushQueue(false);
    }catch(error){console.warn(error);}
    finally{state.snapshotBusy=false;updateSyncChip();}
  }

  function reconcileRemote(remote){
    const pending=[...state.queue];
    state.tracking={...remote};
    const confirmed=[];
    pending.forEach(item=>{
      const r=remote[item.id];
      const capA=item.capacity===null?null:Number(item.capacity);
      const capB=r?.capacity===null||r?.capacity===""||r?.capacity===undefined?null:Number(r.capacity);
      if(r&&r.status===item.status&&capA===capB) confirmed.push(item.mutationId);
      else state.tracking[item.id]={...(state.tracking[item.id]||{}),status:item.status,capacity:item.capacity,updatedAt:new Date(item.createdAt).toISOString()};
    });
    if(confirmed.length) state.queue=state.queue.filter(item=>!confirmed.includes(item.mutationId));
    saveJson(TRACKING_KEY,state.tracking);saveJson(QUEUE_KEY,state.queue);
    updateDashboard();
    if(state.circuit===GENERAL)renderGeneralOverview();else renderList(state.points.filter(p=>p.circuit===state.circuit));
    updateProgress(state.circuit===GENERAL?state.points:state.points.filter(p=>p.circuit===state.circuit));
    updateCircuitMini(state.circuit,state.circuit===GENERAL?state.points:state.points.filter(p=>p.circuit===state.circuit));
  }

  async function flushQueue(scheduleSnapshot=true){
    if(!config.apiUrl||!navigator.onLine||!state.accessCode||!state.queue.length){updateSyncChip();return;}
    const copy=[...state.queue];
    for(const item of copy){
      try{
        const body=new URLSearchParams({key:state.accessCode,circuit:item.circuit,name:item.name,address:item.address,status:item.status,capacity:item.capacity??"",mutationId:item.mutationId});
        await fetch(config.apiUrl,{method:"POST",mode:"no-cors",body});
      }catch(error){console.warn("Envoi différé",error);break;}
    }
    updateSyncChip();
    if(scheduleSnapshot)setTimeout(()=>syncNow(),1300);
  }

  function updateSyncChip(){
    const chip=document.getElementById("syncChip");const label=document.getElementById("syncLabel");
    chip.classList.remove("online","pending","offline");
    if(!navigator.onLine){chip.classList.add("offline");label.textContent=`Hors ligne${state.queue.length?` · ${state.queue.length} en attente`:""}`;return;}
    if(!config.apiUrl){chip.classList.add("pending");label.textContent="Mode local";return;}
    if(state.queue.length||state.snapshotBusy){chip.classList.add("pending");label.textContent=state.queue.length?`${state.queue.length} à synchroniser`:"Synchronisation…";return;}
    chip.classList.add("online");label.textContent="Synchronisé";
  }

  function showAccessModal(message="Accès équipe requis pour synchroniser le suivi collectif."){
    if(!config.apiUrl)return;
    document.getElementById("accessText").textContent=message;
    document.getElementById("accessModal").hidden=false;
    setTimeout(()=>document.getElementById("accessInput").focus(),50);
  }

  function jsonp(url){
    return new Promise((resolve,reject)=>{
      const callback=`__aqcb_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const script=document.createElement("script");
      const timer=setTimeout(()=>cleanup(new Error("Délai de synchronisation dépassé.")),9000);
      function cleanup(error,data){clearTimeout(timer);delete window[callback];script.remove();error?reject(error):resolve(data);}
      window[callback]=data=>cleanup(null,data);
      script.onerror=()=>cleanup(new Error("Synchronisation indisponible."));
      script.src=`${url}&callback=${encodeURIComponent(callback)}&_=${Date.now()}`;document.head.appendChild(script);
    });
  }

  async function geocodeCircuit(missing,token,points,cachedCount){
    setLoading(`Placement des repères : ${cachedCount}/${points.length}.`);
    for(let i=0;i<missing.length;i++){
      if(token!==state.renderToken)return;
      const point=missing[i];const index=points.findIndex(p=>p.name===point.name)+1;const location=await geocodePoint(point);if(token!==state.renderToken)return;
      if(location){state.geocode[point.address]=location;saveJson(CACHE_KEY,state.geocode);addMarker(point,location.lat,location.lon,index,location.approx);updateCardGeocode(point.name,location.approx?"Repère approximatif. Utilise l’itinéraire pour l’adresse exacte.":"Repère placé.");}
      else updateCardGeocode(point.name,"Repère non placé. L’itinéraire reste disponible.");
      setLoading(`Placement des repères : ${Math.min(cachedCount+i+1,points.length)}/${points.length}.`);fitToCurrentMarkers();await sleep(320);
    }
  }

  async function geocodeGeneral(missing,token,total,cachedCount){
    let completed=cachedCount;setLoading(`Carte générale : ${completed}/${total} repères.`);
    for(let i=0;i<missing.length;i+=3){
      if(token!==state.renderToken)return;
      const batch=missing.slice(i,i+3);const results=await Promise.all(batch.map(async point=>({point,location:await geocodePoint(point)})));if(token!==state.renderToken)return;
      results.forEach(({point,location})=>{completed++;if(!location)return;state.geocode[point.address]=location;addMarker(point,location.lat,location.lon,point.circuit,location.approx);});
      saveJson(CACHE_KEY,state.geocode);setLoading(`Carte générale : ${Math.min(completed,total)}/${total} repères.`);fitToCurrentMarkers();await sleep(250);
    }
  }

  async function geocodePoint(point){
    for(const attempt of buildGeocodeAttempts(point.address)){
      try{
        const url=new URL("https://photon.komoot.io/api/");url.searchParams.set("q",attempt);url.searchParams.set("limit","1");url.searchParams.set("lat",String(GRENOBLE[0]));url.searchParams.set("lon",String(GRENOBLE[1]));
        const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),7000);const response=await fetch(url,{signal:controller.signal,referrerPolicy:"no-referrer"});clearTimeout(timer);if(!response.ok)continue;
        const feature=(await response.json())?.features?.[0];if(!feature?.geometry?.coordinates)continue;const [lon,lat]=feature.geometry.coordinates.map(Number);if(!isGrenobleArea(lat,lon))continue;return{lat,lon,approx:attempt!==point.address};
      }catch(error){console.warn("Geocoding",point.name,error);}
    }
    return null;
  }

  function buildGeocodeAttempts(address){const cleaned=address.replace(/\([^)]*\)/g," ").replace(/\s+/g," ").trim();const first=cleaned.split(",")[0].trim().replace(/N[°º]\s*/gi," ").replace(/\s+/g," ").trim();return [...new Set([address,cleaned,`${first}, Grenoble, France`])];}
  function isGrenobleArea(lat,lon){return lat>=BOUNDS.minLat&&lat<=BOUNDS.maxLat&&lon>=BOUNDS.minLon&&lon<=BOUNDS.maxLon;}

  function markerIcon(point){
    const tracking=getTracking(point);const general=state.circuit===GENERAL;return L.divIcon({className:"",html:`<div class="point-dot ${general?"":`marker-${tracking.status}`}">${general?point.circuit:"•"}</div>`,iconSize:[34,34],iconAnchor:[17,17]});
  }
  function addMarker(point,lat,lon,label,approx){const icon=markerIcon(point);if(state.circuit!==GENERAL)icon.options.html=`<div class="point-dot marker-${getTracking(point).status}">${label}</div>`;const marker=L.marker([lat,lon],{icon}).addTo(markerLayer);marker.bindPopup(buildPopup(point,approx));if(state.circuit!==GENERAL)marker.on("click",()=>setActiveCard(point.name));state.markers.set(`${point.circuit}|${point.name}`,marker);if(state.circuit!==GENERAL)state.markers.set(point.name,marker);}
  function buildPopup(point,approx){const wrap=document.createElement("div");wrap.innerHTML=`<div class="popup-title">${state.circuit===GENERAL?`Circuit ${point.circuit} · `:""}${escapeHtml(point.name)}</div><div class="popup-address">${escapeHtml(point.address)}${approx?" · Repère approximatif.":""}</div>`;const a=document.createElement("a");a.className="popup-link";a.target="_blank";a.rel="noopener noreferrer";a.href=googleDirectionsUrl(point.address);a.textContent="Itinéraire.";wrap.append(a);return wrap;}
  function fitToCurrentMarkers(){const layers=markerLayer.getLayers();if(!layers.length)return;const group=L.featureGroup(layers);const bounds=group.getBounds();if(bounds.isValid())map.fitBounds(bounds.pad(.12),{maxZoom:15});}
  function focusPoint(name){const marker=state.markers.get(name);if(!marker)return;map.setView(marker.getLatLng(),17);marker.openPopup();setActiveCard(name);}
  function setActiveCard(name){document.querySelectorAll(".point-card.is-active").forEach(el=>el.classList.remove("is-active"));const card=document.querySelector(`[data-point="${cssEscape(name)}"]`);if(card){card.classList.add("is-active");card.scrollIntoView({behavior:"smooth",block:"center"});}}
  function updateCardGeocode(name,text){const el=document.querySelector(`[data-status-for="${cssEscape(name)}"]`);if(el)el.textContent=text;}

  function locateUser(){if(!navigator.geolocation){setLoading("Géolocalisation indisponible.");return;}setLoading("Recherche de ta position…");navigator.geolocation.getCurrentPosition(pos=>{L.circleMarker([pos.coords.latitude,pos.coords.longitude],{radius:8,color:"#fff",weight:3,fillColor:"#2563eb",fillOpacity:1}).addTo(map).bindPopup("Ta position.").openPopup();map.setView([pos.coords.latitude,pos.coords.longitude],16);setLoading("");},()=>setLoading("Impossible d’obtenir ta position."),{enableHighAccuracy:true,timeout:9000});}
  async function shareCurrentCircuit(){const url=location.href;try{if(navigator.share)await navigator.share({title:document.title,url});else await navigator.clipboard.writeText(url);setLoading("Lien prêt à partager.");setTimeout(()=>setLoading(""),1500);}catch(error){console.warn(error);}}
  async function copyCircuitLink(letter){const url=new URL(location.href);url.searchParams.set("c",letter);try{await navigator.clipboard.writeText(url.toString());setLoading(`Lien du circuit ${letter} copié.`);setTimeout(()=>setLoading(""),1500);}catch(error){console.warn(error);}}
  function googleDirectionsUrl(address){return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`;}
  function setLoading(text){document.getElementById("loading").textContent=text;}
  function saveJson(key,value){try{localStorage.setItem(key,JSON.stringify(value));}catch(error){console.warn(error);}}
  function loadJson(key,fallback){try{const raw=localStorage.getItem(key);return raw?JSON.parse(raw):fallback;}catch{return fallback;}}
  function sleep(ms){return new Promise(resolve=>setTimeout(resolve,ms));}
  function cssEscape(value){return window.CSS?.escape?CSS.escape(value):String(value).replace(/["\\]/g,"\\$&");}
  function escapeHtml(value){return String(value).replace(/[&<>"]/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[char]));}
})();
