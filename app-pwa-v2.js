(() => {
  "use strict";

  const CIRCUITS = {
    A:{zone:"Gare / Europole / Berriat",count:18},B:{zone:"Saint-Bruno / Chorier / Drac / Vallier",count:19},C:{zone:"Île Verte / Jean-Pain / Chavant",count:18},D:{zone:"Centre / Notre-Dame / Saint-Laurent",count:20},E:{zone:"Victor-Hugo / Championnet / Jaurès",count:19},F:{zone:"Vallier / Eaux-Claires / Rhin-et-Danube",count:18},G:{zone:"Bachelard / Libération / Louise-Michel",count:13},H:{zone:"Clemenceau / Jean-Perrot / MC2",count:10},I:{zone:"Alliés / Stalingrad / Foch",count:17},J:{zone:"Clemenceau / Abbaye / Jouhaux",count:16},K:{zone:"Teisseire / Malherbe / MC2",count:15},L:{zone:"Malherbe / Village Olympique / Prémol",count:13},M:{zone:"Arlequin / Géants / Europe",count:13}
  };

  const STATUS_OPTIONS = [
    {value:"todo",label:"À faire",icon:"○"},
    {value:"done",label:"Fait",icon:"✓"},
    {value:"repost",label:"À recoller",icon:"↻"},
    {value:"skip",label:"Passé",icon:"→"}
  ];

  const GENERAL = "ALL";
  const STOCK = "STOCK";
  const GRENOBLE = [45.1885,5.7245];
  const GEO_KEY = "aq-grenoble-geocode-v2";
  const TRACKING_KEY = "aq-grenoble-shared-cache-v2";
  const QUEUE_KEY = "aq-grenoble-sync-queue-v2";
  const ACCESS_KEY = "aq-grenoble-access-v2";
  const config = window.AQ_APP_CONFIG || {apiUrl:""};

  const state = {
    points: [],
    circuit: initialView(),
    tracking: loadJson(TRACKING_KEY,{}),
    queue: loadJson(QUEUE_KEY,[]),
    accessCode: sessionStorage.getItem(ACCESS_KEY) || "",
    markers: new Map(),
    renderToken: 0,
    syncing: false,
    deferredInstall: null
  };

  const map = L.map("map",{zoomControl:true,attributionControl:true}).setView(GRENOBLE,13);
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19,attribution:"&copy; OpenStreetMap contributors"}).addTo(map);
  const markerLayer = L.layerGroup().addTo(map);

  document.addEventListener("DOMContentLoaded", init);

  async function init(){
    buildNav();
    bindControls();
    setupPwa();
    updateSyncChip();

    try{
      const response = await fetch("./data/points.json",{cache:"no-store"});
      if(!response.ok) throw new Error("Données indisponibles.");
      const points = await response.json();
      const boundaryResponse = await fetch("./data/grenoble-boundary.geojson");
      if (!boundaryResponse.ok) throw new Error("Limite communale indisponible.");
      const errors = AQFixedCoordinates.validate(points, await boundaryResponse.json());
      if (errors.length) throw new Error("Coordonnées de la carte non validées.");
      state.points = points;
      // Supprimer uniquement les anciens placements, jamais le suivi ni le stock.
      try { localStorage.removeItem(GEO_KEY); } catch (_) {}
      normalizeLegacyTracking();
      await showView(state.circuit);
      updateDashboard();

      if(config.apiUrl){
        if(state.accessCode) await syncNow();
        else showAccessModal();
      }
    }catch(error){
      console.error(error);
      setLoading("Impossible de charger les points. Réessaie dans quelques instants.");
    }

    window.addEventListener("online",()=>{updateSyncChip();flushQueue();});
    window.addEventListener("offline",updateSyncChip);
  }

  function normalizeLegacyTracking(){
    let changed = false;
    Object.keys(state.tracking).forEach(id=>{
      const entry = state.tracking[id] || {};
      if(entry.status === "vandalized"){ entry.status = "repost"; changed = true; }
      if(entry.status === "covered"){ entry.status = "skip"; changed = true; }
    });
    if(changed) saveJson(TRACKING_KEY,state.tracking);
  }

  function initialView(){
    const requested=(new URLSearchParams(location.search).get("c")||GENERAL).toUpperCase();
    return requested===GENERAL || requested===STOCK || CIRCUITS[requested] ? requested : GENERAL;
  }

  function buildNav(){
    const nav=document.getElementById("circuitNav");
    nav.replaceChildren();
    nav.append(makeNavButton(GENERAL,"◎","Tous"));
    nav.append(makeNavButton(STOCK,"📦","Stock"));
    Object.keys(CIRCUITS).forEach(letter=>nav.append(makeNavButton(letter,letter,`Circuit ${letter}`)));
  }

  function makeNavButton(value,icon,label){
    const b=document.createElement("button");
    b.type="button";
    b.className="circuit-btn";
    b.dataset.circuit=value;
    b.innerHTML=`<span class="circuit-letter">${icon}</span><span class="circuit-label">${label}</span>`;
    b.addEventListener("click",()=>showView(value));
    return b;
  }

  function bindControls(){
    document.getElementById("locateBtn").addEventListener("click",locateUser);
    document.getElementById("shareBtn").addEventListener("click",shareCurrentView);
    document.getElementById("accessForm").addEventListener("submit",async event=>{
      event.preventDefault();
      const value=document.getElementById("accessInput").value.trim();
      if(!value) return;
      state.accessCode=value;
      sessionStorage.setItem(ACCESS_KEY,value);
      document.getElementById("accessModal").hidden=true;
      await syncNow(true);
    });
  }

  function setupPwa(){
    if("serviceWorker" in navigator){
      navigator.serviceWorker.register("./sw-v3.js").catch(console.warn);
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

  async function showView(view){
    if(view!==GENERAL && view!==STOCK && !CIRCUITS[view]) return;
    state.circuit=view;
    const url=new URL(location.href); url.searchParams.set("c",view); history.replaceState(null,"",url);

    document.querySelectorAll(".circuit-btn").forEach(btn=>{
      const active=btn.dataset.circuit===view;
      btn.setAttribute("aria-current",active?"true":"false");
      if(active) btn.scrollIntoView({behavior:"smooth",block:"nearest",inline:"center"});
    });

    if(view===STOCK){
      document.getElementById("mapPanel").hidden=true;
      document.getElementById("mainLayout").classList.add("stock-mode");
      renderStockView();
      return;
    }

    document.getElementById("mapPanel").hidden=false;
    document.getElementById("mainLayout").classList.remove("stock-mode");
    setTimeout(()=>map.invalidateSize(),0);

    const points=view===GENERAL ? state.points : state.points.filter(p=>p.circuit===view);
    updateHeader(view,points);
    markerLayer.clearLayers();
    state.markers.clear();
    map.setView(GRENOBLE,view===GENERAL?12:13);

    if(view===GENERAL) renderGeneralOverview(); else renderList(points);

    points.forEach((point,index)=>{
      addMarker(point,point.lat,point.lon,view===GENERAL?point.circuit:index+1,false);
    });
    fitMarkers();
    setLoading("");
  }

  function updateHeader(view,points){
    const general=view===GENERAL;
    document.getElementById("subtitle").textContent=general?"Vue générale · 209 points · 13 circuits.":`Circuit ${view} · ${CIRCUITS[view].zone}.`;
    document.getElementById("circuitBadge").textContent=general?"Carte générale.":`Circuit ${view}.`;
    document.getElementById("zoneTitle").textContent=general?"Grenoble · tous les circuits.":CIRCUITS[view].zone;
    document.getElementById("count").textContent=`${points.length} points.`;
    document.getElementById("shareBtn").textContent=general?"↗ Partager.":`↗ Circuit ${view}.`;
    document.querySelector(".hint").textContent=general?"Vue d’ensemble. Ouvre un circuit pour le suivi terrain détaillé.":"Pour chaque point : ouvre l’itinéraire, choisis l’état, puis indique la capacité constatée au premier passage.";
    updateProgress(points);
    updateCircuitMini(view,points);
  }

  function updateProgress(points){
    const done=points.filter(p=>getTracking(p).status==="done").length;
    const toTreat=points.filter(p=>["todo","repost"].includes(getTracking(p).status)).length;
    const percent=points.length?Math.round(done/points.length*100):0;
    document.getElementById("progress").innerHTML=`<div class="progress-top"><strong>${done} / ${points.length} faits.</strong><span>${toTreat} à traiter.</span></div><div class="progress-bar"><span style="width:${percent}%"></span></div>`;
  }

  function updateCircuitMini(view,points){
    const host=document.getElementById("circuitMini");
    if(view===GENERAL){ host.innerHTML=""; return; }
    const stock=stockFor(points);
    const repost=points.filter(p=>getTracking(p).status==="repost").length;
    host.innerHTML=`<div class="mini-pill"><strong>${stock.color} couleur · ${stock.bw} N&B</strong><span>stock à préparer.</span></div><div class="mini-pill"><strong>${repost} à recoller</strong><span>sur ce circuit.</span></div>`;
  }

  function renderGeneralOverview(){
    const list=document.getElementById("pointList");
    list.replaceChildren();

    const globalStock=stockFor(state.points);
    const stockCard=document.createElement("li");
    stockCard.className="point-card general-stock-card";
    stockCard.innerHTML=`<div class="point-top"><div class="point-name">📦 Stock à préparer maintenant.</div><span class="poster">${globalStock.total} A3</span></div><div class="stock-kpis"><strong>${globalStock.color} couleur</strong><strong>${globalStock.bw} N&B</strong></div>`;
    const stockBtn=document.createElement("button"); stockBtn.type="button"; stockBtn.className="primary stock-open-btn"; stockBtn.textContent="Ouvrir le stock général."; stockBtn.onclick=()=>showView(STOCK); stockCard.append(stockBtn); list.append(stockCard);

    Object.entries(CIRCUITS).forEach(([letter,info])=>{
      const points=state.points.filter(p=>p.circuit===letter);
      const done=points.filter(p=>getTracking(p).status==="done").length;
      const toTreat=points.filter(p=>["todo","repost"].includes(getTracking(p).status)).length;
      const repost=points.filter(p=>getTracking(p).status==="repost").length;
      const stock=stockFor(points);
      const li=document.createElement("li");
      li.className="point-card";
      li.innerHTML=`<div class="point-top"><div class="point-name">Circuit ${letter} · ${info.zone}</div><span class="poster">${info.count} points</span></div><div class="overview-stats"><span>✅ ${done} faits</span><span>🔁 ${repost} à recoller</span><span>📦 ${stock.color}+${stock.bw}</span><span>${toTreat} à traiter</span></div>`;
      const actions=document.createElement("div"); actions.className="card-actions";
      const open=document.createElement("button"); open.type="button"; open.className="primary"; open.textContent=`Ouvrir le circuit ${letter}.`; open.onclick=()=>showView(letter); actions.append(open); li.append(actions); list.append(li);
    });
  }

  function renderStockView(){
    const stock=stockFor(state.points);
    document.getElementById("subtitle").textContent="Gestion centralisée des affiches.";
    document.getElementById("circuitBadge").textContent="Stock général.";
    document.getElementById("zoneTitle").textContent="Préparation du prochain passage.";
    document.getElementById("count").textContent=`${stock.total} A3.`;
    document.getElementById("progress").innerHTML=`<div class="stock-kpis big"><strong>🎨 ${stock.color} couleur</strong><strong>⚫ ${stock.bw} N&B</strong><strong>📦 ${stock.total} total</strong></div>`;
    document.getElementById("circuitMini").innerHTML="";
    document.querySelector(".hint").textContent="Le stock se recalcule automatiquement à partir des états et des capacités relevées sur le terrain.";
    const list=document.getElementById("pointList"); list.replaceChildren();
    Object.entries(CIRCUITS).forEach(([letter,info])=>{
      const points=state.points.filter(p=>p.circuit===letter);
      const s=stockFor(points);
      const done=points.filter(p=>getTracking(p).status==="done").length;
      const toTreat=points.filter(p=>["todo","repost"].includes(getTracking(p).status)).length;
      const li=document.createElement("li"); li.className="point-card stock-circuit-card";
      li.innerHTML=`<div class="point-top"><div class="point-name">${letter} · ${info.zone}</div><span class="poster">${s.color} couleur + ${s.bw} N&B</span></div><div class="overview-stats"><span>✅ ${done} faits</span><span>${toTreat} à traiter</span></div>`;
      const open=document.createElement("button"); open.type="button"; open.className="primary"; open.textContent=`Voir le circuit ${letter}.`; open.onclick=()=>showView(letter); li.append(open); list.append(li);
    });
  }

  function renderList(points){
    const list=document.getElementById("pointList"); list.replaceChildren();
    points.forEach((point,index)=>{
      const tracking=getTracking(point);
      const li=document.createElement("li"); li.className=`point-card status-${tracking.status}`; li.dataset.point=point.name;
      const top=document.createElement("div"); top.className="point-top";
      const name=document.createElement("div"); name.className="point-name"; name.textContent=`${index+1}. ${point.name}`;
      const poster=document.createElement("span"); poster.className=`poster ${point.poster.includes("Couleur")?"color":"bw"}`; poster.textContent=point.poster; top.append(name,poster);
      const address=document.createElement("p"); address.className="address"; address.textContent=point.address;
      const actions=document.createElement("div"); actions.className="card-actions";
      const route=document.createElement("a"); route.className="primary"; route.target="_blank"; route.rel="noopener noreferrer"; route.href=googleDirectionsUrl(point); route.innerHTML='<span class="action-icon">↗</span><span>Itinéraire.</span>';
      const zoom=document.createElement("button"); zoom.type="button"; zoom.innerHTML='<span class="action-icon">⌖</span><span>Voir sur la carte.</span>'; zoom.onclick=()=>focusPoint(point.name); actions.append(route,zoom);

      const tracker=document.createElement("div"); tracker.className="tracker-box";
      const statusTitle=document.createElement("div"); statusTitle.className="tracker-title"; statusTitle.innerHTML='<strong>État du point.</strong><span>Choisis une case.</span>';
      const statusGrid=document.createElement("div"); statusGrid.className="status-grid";
      STATUS_OPTIONS.forEach(option=>{
        const b=document.createElement("button"); b.type="button"; b.className=`status-btn status-choice-${option.value}`; b.dataset.value=option.value; b.setAttribute("aria-pressed",tracking.status===option.value?"true":"false"); b.innerHTML=`<span class="status-icon">${option.icon}</span><span>${option.label}.</span>`; b.onclick=()=>setPointStatus(point,option.value); statusGrid.append(b);
      });

      const capacity=document.createElement("div"); capacity.className="capacity-block"; capacity.innerHTML='<div class="tracker-title"><strong>Capacité constatée.</strong><span>Affiches A3 possibles.</span></div>';
      const capacityGrid=document.createElement("div"); capacityGrid.className="capacity-grid";
      [1,2,3,4].forEach(value=>{
        const b=document.createElement("button"); b.type="button"; b.className="capacity-btn"; b.dataset.capacity=String(value); b.setAttribute("aria-pressed",tracking.capacity===value?"true":"false"); b.innerHTML=`<strong>${value}</strong><span>affiche${value>1?"s":""}</span>`; b.onclick=()=>setPointCapacity(point,value); capacityGrid.append(b);
      });
      capacity.append(capacityGrid);

      const save=document.createElement("div"); save.className="save-state"; save.dataset.saveFor=trackingId(point); updateSaveState(save,point);
      const geo=document.createElement("div"); geo.className="geocode-status"; geo.dataset.statusFor=point.name; geo.textContent="Repère vérifié.";
      tracker.append(statusTitle,statusGrid,capacity,save);
      li.append(top,address,actions,tracker,geo); list.append(li);
    });
  }

  function trackingId(point){ return `${point.circuit}|${point.name}`; }
  function getTracking(point){ return {status:"todo",capacity:null,...(state.tracking[trackingId(point)]||{})}; }

  function setPointStatus(point,status){
    const current=getTracking(point); if(current.status===status) return;
    mutate(point,{status,capacity:current.capacity});
  }

  function setPointCapacity(point,capacity){
    const current=getTracking(point); if(current.capacity===capacity) return;
    mutate(point,{status:current.status,capacity});
  }

  function mutate(point,next){
    const id=trackingId(point);
    state.tracking[id]={...getTracking(point),...next};
    saveJson(TRACKING_KEY,state.tracking);
    const mutation={id,mutationId:`${Date.now()}-${Math.random().toString(36).slice(2,8)}`,circuit:point.circuit,name:point.name,address:point.address,status:state.tracking[id].status,capacity:state.tracking[id].capacity};
    state.queue=state.queue.filter(item=>item.id!==id); state.queue.push(mutation); saveJson(QUEUE_KEY,state.queue);
    refreshPoint(point); updateDashboard(); updateSyncChip(); flushQueue();
  }

  function refreshPoint(point){
    if(state.circuit===GENERAL){ renderGeneralOverview(); updateProgress(state.points); return; }
    if(state.circuit===STOCK){ renderStockView(); return; }
    const card=document.querySelector(`[data-point="${cssEscape(point.name)}"]`); if(!card) return;
    const tracking=getTracking(point);
    card.className=`point-card status-${tracking.status}${card.classList.contains("is-active")?" is-active":""}`;
    STATUS_OPTIONS.forEach(option=>card.querySelector(`.status-btn[data-value="${option.value}"]`)?.setAttribute("aria-pressed",tracking.status===option.value?"true":"false"));
    card.querySelectorAll(".capacity-btn").forEach(btn=>btn.setAttribute("aria-pressed",Number(btn.dataset.capacity)===tracking.capacity?"true":"false"));
    updateSaveState(card.querySelector(".save-state"),point);
    const points=state.points.filter(p=>p.circuit===state.circuit); updateProgress(points); updateCircuitMini(state.circuit,points);
    const marker=state.markers.get(point.name); if(marker) marker.setIcon(makeMarkerIcon(point,marker.options._label||"•"));
  }

  function updateSaveState(el,point){
    if(!el) return;
    const pending=state.queue.some(item=>item.id===trackingId(point));
    el.className=`save-state ${pending?"pending":"synced"}`;
    el.textContent=pending ? (navigator.onLine?"Modification en cours de synchronisation.":"Hors ligne · modification gardée en attente.") : (config.apiUrl?"Synchronisé avec le suivi collectif.":"Mode local.");
  }

  function stockFor(points){
    let color=0,bw=0;
    points.forEach(point=>{
      const t=getTracking(point);
      if(!["todo","repost"].includes(t.status)) return;
      const qty=Number(t.capacity)||1;
      if(point.poster.includes("Couleur")) color+=qty; else bw+=qty;
    });
    return {color,bw,total:color+bw};
  }

  function updateDashboard(){
    if(!state.points.length) return;
    const stock=stockFor(state.points);
    const done=state.points.filter(p=>getTracking(p).status==="done").length;
    const repost=state.points.filter(p=>getTracking(p).status==="repost").length;
    const verified=state.points.filter(p=>Number(getTracking(p).capacity)>=1).length;
    document.getElementById("statStock").textContent=`${stock.color} + ${stock.bw}`;
    document.getElementById("statStockMeta").textContent="couleur + N&B à préparer.";
    document.getElementById("statDone").textContent=`${done} / ${state.points.length}`;
    document.getElementById("statRecoller").textContent=String(repost);
    document.getElementById("statVerified").textContent=`${verified} / ${state.points.length}`;
  }

  async function syncNow(force=false){
    if(!config.apiUrl || !navigator.onLine || state.syncing) return;
    if(!state.accessCode){ showAccessModal(); return; }
    state.syncing=true; updateSyncChip();
    try{
      const remote=await jsonp(`${config.apiUrl}?action=snapshot&key=${encodeURIComponent(state.accessCode)}`);
      if(!remote?.ok){
        if(force) showAccessModal(remote?.error||"Code incorrect.");
        throw new Error(remote?.error||"Synchronisation impossible.");
      }
      state.tracking=remote.tracking||{};
      saveJson(TRACKING_KEY,state.tracking);
      await flushQueue(false);
      updateDashboard();
      if(state.circuit===GENERAL) renderGeneralOverview();
      else if(state.circuit===STOCK) renderStockView();
      else renderList(state.points.filter(p=>p.circuit===state.circuit));
      updateProgress(state.circuit===GENERAL?state.points:state.circuit===STOCK?state.points:state.points.filter(p=>p.circuit===state.circuit));
      if(state.circuit!==GENERAL && state.circuit!==STOCK) updateCircuitMini(state.circuit,state.points.filter(p=>p.circuit===state.circuit));
    }catch(error){ console.warn(error); }
    finally{ state.syncing=false; updateSyncChip(); }
  }

  async function flushQueue(scheduleSnapshot=true){
    if(!config.apiUrl || !navigator.onLine || !state.accessCode || !state.queue.length){ updateSyncChip(); return; }
    const copy=[...state.queue];
    for(const item of copy){
      try{
        const body=new URLSearchParams({key:state.accessCode,circuit:item.circuit,name:item.name,address:item.address,status:item.status,capacity:item.capacity??"",mutationId:item.mutationId});
        await fetch(config.apiUrl,{method:"POST",mode:"no-cors",body});
        state.queue=state.queue.filter(q=>q.mutationId!==item.mutationId);
        saveJson(QUEUE_KEY,state.queue);
      }catch(error){ console.warn(error); break; }
    }
    updateSyncChip();
    if(scheduleSnapshot) setTimeout(()=>syncNow(),1100);
  }

  function updateSyncChip(){
    const chip=document.getElementById("syncChip"), label=document.getElementById("syncLabel");
    chip.classList.remove("online","pending","offline");
    if(!navigator.onLine){ chip.classList.add("offline"); label.textContent=`Hors ligne${state.queue.length?` · ${state.queue.length} en attente`:""}`; return; }
    if(!config.apiUrl){ chip.classList.add("pending"); label.textContent="Mode local"; return; }
    if(state.syncing || state.queue.length){ chip.classList.add("pending"); label.textContent=state.queue.length?`${state.queue.length} à synchroniser`:"Synchronisation…"; return; }
    chip.classList.add("online"); label.textContent="Synchronisé";
  }

  function showAccessModal(message="Entre le code partagé dans le groupe pour synchroniser le suivi collectif."){
    document.getElementById("accessText").textContent=message;
    document.getElementById("accessModal").hidden=false;
    setTimeout(()=>document.getElementById("accessInput").focus(),50);
  }

  function jsonp(url){
    return new Promise((resolve,reject)=>{
      const callback=`__aqcb_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const script=document.createElement("script");
      const timer=setTimeout(()=>cleanup(new Error("Délai de synchronisation dépassé.")),10000);
      function cleanup(error,data){ clearTimeout(timer); delete window[callback]; script.remove(); error?reject(error):resolve(data); }
      window[callback]=data=>cleanup(null,data);
      script.onerror=()=>cleanup(new Error("Synchronisation indisponible."));
      script.src=`${url}&callback=${encodeURIComponent(callback)}&_=${Date.now()}`;
      document.head.appendChild(script);
    });
  }

  function makeMarkerIcon(point,label){
    const status=getTracking(point).status;
    return L.divIcon({className:"",html:`<div class="point-dot ${state.circuit===GENERAL?"":`marker-${status}`}">${label}</div>`,iconSize:[34,34],iconAnchor:[17,17]});
  }

  function addMarker(point,lat,lon,label,approx){
    const marker=L.marker([lat,lon],{icon:makeMarkerIcon(point,label)}).addTo(markerLayer);
    marker.options._label=label;
    marker.bindPopup(buildPopup(point,approx));
    if(state.circuit!==GENERAL) marker.on("click",()=>setActiveCard(point.name));
    state.markers.set(`${point.circuit}|${point.name}`,marker);
    if(state.circuit!==GENERAL) state.markers.set(point.name,marker);
  }

  function buildPopup(point,approx){
    const wrap=document.createElement("div");
    const title=document.createElement("div"); title.className="popup-title"; title.textContent=state.circuit===GENERAL?`Circuit ${point.circuit} · ${point.name}`:point.name;
    const address=document.createElement("div"); address.className="popup-address"; address.textContent=`${point.address}${approx?" · Repère approximatif.":""}`;
    const link=document.createElement("a"); link.className="popup-link"; link.target="_blank"; link.rel="noopener noreferrer"; link.href=googleDirectionsUrl(point); link.textContent="Itinéraire.";
    wrap.append(title,address,link); return wrap;
  }

  function fitMarkers(){
    const layers=markerLayer.getLayers(); if(!layers.length) return;
    const bounds=L.featureGroup(layers).getBounds(); if(bounds.isValid()) map.fitBounds(bounds.pad(.12),{maxZoom:15});
  }

  function focusPoint(name){
    const marker=state.markers.get(name); if(!marker) return;
    map.setView(marker.getLatLng(),17); marker.openPopup(); setActiveCard(name);
  }

  function setActiveCard(name){
    document.querySelectorAll(".point-card.is-active").forEach(el=>el.classList.remove("is-active"));
    const card=document.querySelector(`[data-point="${cssEscape(name)}"]`); if(card){ card.classList.add("is-active"); card.scrollIntoView({behavior:"smooth",block:"center"}); }
  }

  function updateCardGeocode(name,text){ const el=document.querySelector(`[data-status-for="${cssEscape(name)}"]`); if(el) el.textContent=text; }

  function locateUser(){
    if(!navigator.geolocation){ setLoading("Géolocalisation indisponible."); return; }
    setLoading("Recherche de ta position…");
    navigator.geolocation.getCurrentPosition(pos=>{
      L.circleMarker([pos.coords.latitude,pos.coords.longitude],{radius:8,color:"#fff",weight:3,fillColor:"#2563eb",fillOpacity:1}).addTo(map).bindPopup("Ta position.").openPopup();
      map.setView([pos.coords.latitude,pos.coords.longitude],16); setLoading("");
    },()=>{ setLoading("Position indisponible. Vérifie l’autorisation GPS du navigateur."); setTimeout(()=>setLoading(""),3500); },{enableHighAccuracy:true,timeout:9000});
  }

  async function shareCurrentView(){
    const url=location.href;
    const title=state.circuit===GENERAL?"Carte générale · AQ Grenoble":state.circuit===STOCK?"Stock général · AQ Grenoble":`Circuit ${state.circuit} · AQ Grenoble`;
    try{
      if(navigator.share) await navigator.share({title,url});
      else if(navigator.clipboard){ await navigator.clipboard.writeText(url); setLoading("Lien copié."); setTimeout(()=>setLoading(""),1600); }
    }catch(error){ if(error?.name!=="AbortError") console.warn(error); }
  }

  function googleDirectionsUrl(point){ return AQFixedCoordinates.directionsUrl(point); }
  function loadJson(key,fallback){ try{return JSON.parse(localStorage.getItem(key)||JSON.stringify(fallback));}catch{return fallback;} }
  function saveJson(key,value){ try{localStorage.setItem(key,JSON.stringify(value));}catch{} }
  function setLoading(text){ document.getElementById("loading").textContent=text; }
  function sleep(ms){ return new Promise(resolve=>setTimeout(resolve,ms)); }
  function cssEscape(value){ if(window.CSS?.escape) return CSS.escape(value); return value.replace(/["\\]/g,"\\$&"); }
})();
