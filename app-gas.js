(() => {
  "use strict";

  const CIRCUITS = {
    A: { zone: "Gare / Europole / Berriat", count: 18 },
    B: { zone: "Saint-Bruno / Chorier / Drac / Vallier", count: 19 },
    C: { zone: "Île Verte / Jean-Pain / Chavant", count: 18 },
    D: { zone: "Centre / Notre-Dame / Saint-Laurent", count: 20 },
    E: { zone: "Victor-Hugo / Championnet / Jaurès", count: 19 },
    F: { zone: "Vallier / Eaux-Claires / Rhin-et-Danube", count: 18 },
    G: { zone: "Bachelard / Libération / Louise-Michel", count: 13 },
    H: { zone: "Clemenceau / Jean-Perrot / MC2", count: 10 },
    I: { zone: "Alliés / Stalingrad / Foch", count: 17 },
    J: { zone: "Clemenceau / Abbaye / Jouhaux", count: 16 },
    K: { zone: "Teisseire / Malherbe / MC2", count: 15 },
    L: { zone: "Malherbe / Village Olympique / Prémol", count: 13 },
    M: { zone: "Arlequin / Géants / Europe", count: 13 }
  };

  const STATUS_OPTIONS = [
    { value: "todo", label: "À faire", icon: "○" },
    { value: "done", label: "Fait", icon: "✓" },
    { value: "repost", label: "À recoller", icon: "↻" },
    { value: "skip", label: "Passé", icon: "→" }
  ];

  const GENERAL_VIEW = "ALL";
  const STOCK_VIEW = "STOCK";
  const GRENOBLE = [45.1885, 5.7245];
  const CACHE_KEY = "aq-grenoble-geocode-v2";
  const BOUNDS = { minLat: 45.08, maxLat: 45.30, minLon: 5.55, maxLon: 5.95 };

  const state = {
    points: [],
    tracking: {},
    stock: null,
    circuit: GENERAL_VIEW,
    markers: new Map(),
    cache: loadJson(CACHE_KEY, {}),
    renderToken: 0,
    ready: false,
    pollTimer: null
  };

  let map;
  let markerLayer;

  document.addEventListener("DOMContentLoaded", init);

  function init() {
    if (!window.google?.script?.run) {
      setSync("Cette version doit être ouverte depuis l’application collective.", "error");
      return;
    }

    map = L.map("map", { zoomControl: true, attributionControl: true }).setView(GRENOBLE, 13);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap contributors"
    }).addTo(map);
    markerLayer = L.layerGroup().addTo(map);

    buildNav();
    bindControls();
    loadSharedData(true);
    state.pollTimer = setInterval(() => loadSharedData(false), 30000);
  }

  function buildNav() {
    const nav = document.getElementById("circuitNav");
    nav.replaceChildren();

    nav.appendChild(makeNavButton(GENERAL_VIEW, "◎", "Tous", "Carte générale · 209 points"));
    nav.appendChild(makeNavButton(STOCK_VIEW, "📦", "Stock", "Stock général"));

    Object.keys(CIRCUITS).forEach(letter => {
      nav.appendChild(makeNavButton(letter, letter, `Circuit ${letter}`, `${letter} · ${CIRCUITS[letter].zone}`));
    });
  }

  function makeNavButton(value, icon, label, title) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "circuit-btn";
    button.dataset.circuit = value;
    button.title = title;
    button.innerHTML = `<span class="circuit-letter">${icon}</span><span class="circuit-label">${label}</span>`;
    button.addEventListener("click", () => showView(value));
    return button;
  }

  function bindControls() {
    document.getElementById("locateBtn").addEventListener("click", locateUser);
    document.getElementById("shareBtn").addEventListener("click", shareCurrentView);
    document.getElementById("syncStatus").addEventListener("click", () => loadSharedData(true));
  }

  function loadSharedData(showMessage) {
    if (showMessage) setSync("Synchronisation…", "loading");
    google.script.run
      .withSuccessHandler(data => {
        const previousView = state.circuit;
        state.points = Array.isArray(data?.points) ? data.points : [];
        state.tracking = data?.tracking || {};
        state.stock = data?.stock || null;
        state.ready = true;
        setSync("Synchronisé", "ok");
        showView(previousView || GENERAL_VIEW, { preserveScroll: true, refreshOnly: !showMessage });
      })
      .withFailureHandler(error => {
        setSync("Synchronisation impossible", "error");
        if (showMessage) setLoading(error?.message || "Impossible de charger le suivi collectif.");
      })
      .aqGetData();
  }

  async function showView(view, options = {}) {
    if (!state.ready && view !== STOCK_VIEW) return;
    if (view !== GENERAL_VIEW && view !== STOCK_VIEW && !CIRCUITS[view]) return;

    state.circuit = view;
    state.renderToken += 1;
    const token = state.renderToken;

    document.querySelectorAll(".circuit-btn").forEach(btn => {
      const active = btn.dataset.circuit === view;
      btn.setAttribute("aria-current", active ? "true" : "false");
      if (active && !options.refreshOnly) btn.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    });

    const stockMode = view === STOCK_VIEW;
    document.getElementById("mapPanel").hidden = stockMode;
    document.getElementById("mainLayout").classList.toggle("stock-mode", stockMode);
    document.getElementById("stockEditor").hidden = !stockMode;

    if (stockMode) {
      renderStockView();
      return;
    }

    const points = view === GENERAL_VIEW ? state.points : state.points.filter(point => point.circuit === view);
    updateHeader(view, points);
    markerLayer.clearLayers();
    state.markers.clear();
    map.setView(GRENOBLE, view === GENERAL_VIEW ? 12 : 13);

    if (view === GENERAL_VIEW) renderGeneralOverview();
    else renderList(points);

    const cached = points.filter(point => state.cache[point.address]);
    cached.forEach(point => {
      const loc = state.cache[point.address];
      const number = view === GENERAL_VIEW ? point.circuit : points.findIndex(p => p.name === point.name) + 1;
      addMarker(point, loc.lat, loc.lon, number, loc.approx);
    });
    fitToCurrentMarkers();

    const missing = points.filter(point => !state.cache[point.address]);
    if (!missing.length) {
      setLoading("");
      return;
    }

    if (view === GENERAL_VIEW) await geocodeGeneralView(missing, token, points.length, cached.length);
    else await geocodeCircuitView(missing, token, points, cached.length);
    if (token === state.renderToken) setLoading("");
  }

  function updateHeader(view, points) {
    const hint = document.querySelector(".hint");
    if (view === GENERAL_VIEW) {
      document.getElementById("subtitle").textContent = "Vue générale · 209 points · 13 circuits.";
      document.getElementById("circuitBadge").textContent = "Carte générale.";
      document.getElementById("zoneTitle").textContent = "Grenoble · tous les circuits.";
      document.getElementById("count").textContent = `${points.length} points.`;
      document.getElementById("shareBtn").textContent = "↗ Partager la carte générale.";
      hint.textContent = "Vue d’ensemble. Touche un circuit pour passer au suivi terrain détaillé.";
      renderGeneralProgress();
      document.title = "Carte générale · Collage AQ Grenoble";
      return;
    }

    const info = CIRCUITS[view];
    document.getElementById("subtitle").textContent = `Circuit ${view} · ${info.zone}.`;
    document.getElementById("circuitBadge").textContent = `Circuit ${view}.`;
    document.getElementById("zoneTitle").textContent = info.zone;
    document.getElementById("count").textContent = `${points.length} points.`;
    document.getElementById("shareBtn").textContent = "↗ Partager ce circuit.";
    hint.textContent = "Pour chaque point : ouvre l’itinéraire, choisis l’état, puis indique la capacité constatée lors du premier passage.";
    updateProgress(points);
    document.title = `Circuit ${view} · Collage AQ Grenoble`;
  }

  function renderGeneralProgress() {
    const progress = document.getElementById("progress");
    const done = state.stock?.done || 0;
    const remaining = state.stock?.toTreat ?? Math.max(0, 209 - done);
    const percent = Math.round((done / 209) * 100);
    progress.innerHTML = `
      <div class="progress-top"><strong>${done} / 209 faits.</strong><span>${remaining} à traiter.</span></div>
      <div class="progress-bar" aria-label="Progression globale ${percent}%"><span style="width:${percent}%"></span></div>
    `;
  }

  function updateProgress(points) {
    const done = points.filter(point => getTracking(point).status === "done").length;
    const remaining = points.filter(point => ["todo", "repost"].includes(getTracking(point).status)).length;
    const percent = points.length ? Math.round((done / points.length) * 100) : 0;
    document.getElementById("progress").innerHTML = `
      <div class="progress-top"><strong>${done} / ${points.length} faits.</strong><span>${remaining} à traiter.</span></div>
      <div class="progress-bar" aria-label="Progression ${percent}%"><span style="width:${percent}%"></span></div>
    `;
  }

  function renderGeneralOverview() {
    const list = document.getElementById("pointList");
    list.replaceChildren();

    if (state.stock) {
      const stockCard = document.createElement("li");
      stockCard.className = "point-card general-stock-card";
      stockCard.innerHTML = `
        <div class="point-top"><div class="point-name">📦 Stock à préparer maintenant.</div><span class="poster">${state.stock.total} A3</span></div>
        <div class="stock-kpis"><strong>${state.stock.color} couleur</strong><strong>${state.stock.bw} N&B</strong></div>
      `;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "primary stock-open-btn";
      button.textContent = "Ouvrir la gestion du stock.";
      button.addEventListener("click", () => showView(STOCK_VIEW));
      stockCard.appendChild(button);
      list.appendChild(stockCard);
    }

    Object.entries(CIRCUITS).forEach(([letter, info]) => {
      const trackingPoints = state.points.filter(p => p.circuit === letter);
      const done = trackingPoints.filter(p => getTracking(p).status === "done").length;
      const toTreat = trackingPoints.filter(p => ["todo", "repost"].includes(getTracking(p).status)).length;
      const li = document.createElement("li");
      li.className = "point-card";
      li.innerHTML = `
        <div class="point-top"><div class="point-name">Circuit ${letter} · ${info.zone}</div><span class="poster">${info.count} points</span></div>
        <div class="overview-stats"><span>✅ ${done} faits</span><span>🔁 ${toTreat} à traiter</span></div>
      `;
      const actions = document.createElement("div");
      actions.className = "card-actions";
      const open = document.createElement("button");
      open.type = "button";
      open.className = "primary";
      open.textContent = `Ouvrir le circuit ${letter}.`;
      open.addEventListener("click", () => showView(letter));
      actions.appendChild(open);
      li.appendChild(actions);
      list.appendChild(li);
    });
  }

  function renderStockView() {
    const stock = state.stock || { owner: "", color: 0, bw: 0, total: 0, done: 0, toTreat: 0, circuits: [] };
    document.getElementById("subtitle").textContent = "Gestion centralisée des affiches.";
    document.getElementById("circuitBadge").textContent = "Stock général.";
    document.getElementById("zoneTitle").textContent = "Préparation du prochain passage.";
    document.getElementById("count").textContent = `${stock.total} A3.`;
    document.querySelector(".hint").textContent = "Le stock se recalcule automatiquement à partir des états et des capacités relevées sur le terrain.";
    document.getElementById("progress").innerHTML = `
      <div class="stock-kpis big"><strong>🎨 ${stock.color} couleur</strong><strong>⚫ ${stock.bw} N&B</strong><strong>📦 ${stock.total} total</strong></div>
    `;

    const editor = document.getElementById("stockEditor");
    editor.innerHTML = `
      <label for="stockOwner"><strong>👤 Responsable stock.</strong></label>
      <div class="stock-owner-row">
        <input id="stockOwner" type="text" maxlength="80" value="${escapeHtml(stock.owner || "")}" placeholder="Nom ou équipe responsable">
        <button id="saveStockOwner" type="button" class="primary">Enregistrer.</button>
      </div>
    `;
    document.getElementById("saveStockOwner").addEventListener("click", saveStockOwner);

    const list = document.getElementById("pointList");
    list.replaceChildren();
    (stock.circuits || []).forEach(item => {
      const li = document.createElement("li");
      li.className = "point-card stock-circuit-card";
      li.innerHTML = `
        <div class="point-top"><div class="point-name">${item.circuit} · ${item.zone}</div><span class="poster">${item.stock}</span></div>
        <div class="overview-stats"><span>✅ ${item.done} faits</span><span>🔁 ${item.toTreat} à traiter</span></div>
      `;
      const open = document.createElement("button");
      open.type = "button";
      open.className = "primary";
      open.textContent = `Voir le circuit ${item.circuit}.`;
      open.addEventListener("click", () => showView(item.circuit));
      li.appendChild(open);
      list.appendChild(li);
    });
    document.title = "Stock général · AQ Grenoble";
  }

  function saveStockOwner() {
    const input = document.getElementById("stockOwner");
    const value = input?.value?.trim() || "";
    setSync("Enregistrement…", "loading");
    google.script.run
      .withSuccessHandler(stock => {
        state.stock = stock;
        setSync("Synchronisé", "ok");
        renderStockView();
      })
      .withFailureHandler(error => {
        setSync("Erreur d’enregistrement", "error");
        setLoading(error?.message || "Impossible d’enregistrer le responsable stock.");
      })
      .aqSetStockOwner(value);
  }

  function renderList(points) {
    const list = document.getElementById("pointList");
    list.replaceChildren();

    points.forEach((point, index) => {
      const tracking = getTracking(point);
      const li = document.createElement("li");
      li.className = `point-card status-${tracking.status}`;
      li.dataset.point = point.name;

      const top = document.createElement("div");
      top.className = "point-top";
      const name = document.createElement("div");
      name.className = "point-name";
      name.textContent = `${index + 1}. ${point.name}`;
      const poster = document.createElement("span");
      poster.className = `poster ${point.poster.includes("Couleur") ? "color" : "bw"}`;
      poster.textContent = point.poster;
      top.append(name, poster);

      const address = document.createElement("p");
      address.className = "address";
      address.textContent = point.address;

      const actions = document.createElement("div");
      actions.className = "card-actions";
      const route = document.createElement("a");
      route.className = "primary";
      route.target = "_blank";
      route.rel = "noopener noreferrer";
      route.href = googleDirectionsUrl(point.address);
      route.innerHTML = `<span class="action-icon">↗</span><span>Itinéraire.</span>`;
      const zoom = document.createElement("button");
      zoom.type = "button";
      zoom.innerHTML = `<span class="action-icon">⌖</span><span>Voir sur la carte.</span>`;
      zoom.addEventListener("click", () => focusPoint(point.name));
      actions.append(route, zoom);

      const tracker = document.createElement("div");
      tracker.className = "tracker-box";

      const statusTitle = document.createElement("div");
      statusTitle.className = "tracker-title";
      statusTitle.innerHTML = `<strong>ÉTAT.</strong><span>Choisis exactement l’état du point.</span>`;
      const statusGrid = document.createElement("div");
      statusGrid.className = "status-grid";
      STATUS_OPTIONS.forEach(option => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = `status-btn status-choice-${option.value}`;
        button.dataset.value = option.value;
        button.setAttribute("aria-pressed", tracking.status === option.value ? "true" : "false");
        button.innerHTML = `<span class="status-icon">${option.icon}</span><span>${option.label}.</span>`;
        button.addEventListener("click", () => setPointStatus(point, option.value));
        statusGrid.appendChild(button);
      });

      const capacityBlock = document.createElement("div");
      capacityBlock.className = "capacity-block";
      const capacityTitle = document.createElement("div");
      capacityTitle.className = "tracker-title capacity-title";
      capacityTitle.innerHTML = `<strong>CAPACITÉ A3.</strong><span>Au premier passage, indique combien d’affiches tiennent sur le panneau.</span>`;
      const capacityGrid = document.createElement("div");
      capacityGrid.className = "capacity-grid";
      [1, 2, 3, 4].forEach(value => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "capacity-btn";
        button.setAttribute("aria-pressed", tracking.capacity === value ? "true" : "false");
        button.innerHTML = `<strong>${value}</strong><span>affiche${value > 1 ? "s" : ""}</span>`;
        button.addEventListener("click", () => setPointCapacity(point, value));
        capacityGrid.appendChild(button);
      });
      capacityBlock.append(capacityTitle, capacityGrid);

      const sharedNote = document.createElement("div");
      sharedNote.className = "local-note shared-note";
      sharedNote.textContent = "Suivi partagé avec toute l’équipe.";

      tracker.append(statusTitle, statusGrid, capacityBlock, sharedNote);
      const geocodeStatus = document.createElement("div");
      geocodeStatus.className = "geocode-status";
      geocodeStatus.dataset.statusFor = point.name;
      geocodeStatus.textContent = state.cache[point.address] ? "Repère chargé." : "Placement du repère en cours.";

      li.append(top, address, actions, tracker, geocodeStatus);
      list.appendChild(li);
    });
  }

  function trackingId(point) {
    return `${point.circuit}|${point.address}`;
  }

  function getTracking(point) {
    return { status: "todo", capacity: null, ...(state.tracking[trackingId(point)] || {}) };
  }

  function setPointStatus(point, status) {
    const id = trackingId(point);
    const previous = { ...getTracking(point) };
    state.tracking[id] = { ...previous, status };
    refreshPointTracking(point);
    savePoint(point, { status }, previous);
  }

  function setPointCapacity(point, capacity) {
    const id = trackingId(point);
    const previous = { ...getTracking(point) };
    state.tracking[id] = { ...previous, capacity };
    refreshPointTracking(point);
    savePoint(point, { capacity }, previous);
  }

  function savePoint(point, patch, previous) {
    setSync("Enregistrement…", "loading");
    google.script.run
      .withSuccessHandler(result => {
        if (result?.id && result?.tracking) state.tracking[result.id] = result.tracking;
        if (result?.stock) state.stock = result.stock;
        setSync("Synchronisé", "ok");
        refreshPointTracking(point);
      })
      .withFailureHandler(error => {
        state.tracking[trackingId(point)] = previous;
        refreshPointTracking(point);
        setSync("Erreur d’enregistrement", "error");
        setLoading(error?.message || "La modification n’a pas été enregistrée.");
        setTimeout(() => setLoading(""), 4000);
      })
      .aqUpdatePoint({ circuit: point.circuit, address: point.address, ...patch });
  }

  function refreshPointTracking(point) {
    const card = document.querySelector(`[data-point="${cssEscape(point.name)}"]`);
    if (!card) return;
    const tracking = getTracking(point);
    STATUS_OPTIONS.forEach(option => {
      card.querySelector(`.status-btn[data-value="${option.value}"]`)?.setAttribute("aria-pressed", tracking.status === option.value ? "true" : "false");
    });
    card.querySelectorAll(".capacity-btn").forEach((button, index) => {
      button.setAttribute("aria-pressed", tracking.capacity === index + 1 ? "true" : "false");
    });
    card.className = `point-card status-${tracking.status}${card.classList.contains("is-active") ? " is-active" : ""}`;
    if (CIRCUITS[state.circuit]) updateProgress(state.points.filter(p => p.circuit === state.circuit));
  }

  async function geocodeCircuitView(missing, token, points, cachedCount) {
    setLoading(`Placement des repères : ${cachedCount}/${points.length}.`);
    for (let i = 0; i < missing.length; i += 1) {
      if (token !== state.renderToken) return;
      const point = missing[i];
      const pointIndex = points.findIndex(p => p.name === point.name) + 1;
      const location = await geocodePoint(point);
      if (token !== state.renderToken) return;
      if (location) {
        state.cache[point.address] = location;
        saveJson(CACHE_KEY, state.cache);
        addMarker(point, location.lat, location.lon, pointIndex, location.approx);
        updateCardGeocode(point.name, location.approx ? "Repère approximatif. Utilise l’itinéraire pour l’adresse exacte." : "Repère placé.");
      } else {
        updateCardGeocode(point.name, "Repère non placé. L’itinéraire reste disponible.");
      }
      setLoading(`Placement des repères : ${Math.min(cachedCount + i + 1, points.length)}/${points.length}.`);
      fitToCurrentMarkers();
      await sleep(320);
    }
  }

  async function geocodeGeneralView(missing, token, total, cachedCount) {
    let completed = cachedCount;
    setLoading(`Carte générale : ${completed}/${total} repères chargés.`);
    for (let i = 0; i < missing.length; i += 3) {
      if (token !== state.renderToken) return;
      const batch = missing.slice(i, i + 3);
      const results = await Promise.all(batch.map(async point => ({ point, location: await geocodePoint(point) })));
      if (token !== state.renderToken) return;
      results.forEach(({ point, location }) => {
        completed += 1;
        if (!location) return;
        state.cache[point.address] = location;
        addMarker(point, location.lat, location.lon, point.circuit, location.approx);
      });
      saveJson(CACHE_KEY, state.cache);
      setLoading(`Carte générale : ${Math.min(completed, total)}/${total} repères chargés.`);
      fitToCurrentMarkers();
      await sleep(250);
    }
  }

  async function geocodePoint(point) {
    const attempts = buildGeocodeAttempts(point.address);
    for (let i = 0; i < attempts.length; i += 1) {
      try {
        const url = new URL("https://photon.komoot.io/api/");
        url.searchParams.set("q", attempts[i]);
        url.searchParams.set("limit", "1");
        url.searchParams.set("lat", String(GRENOBLE[0]));
        url.searchParams.set("lon", String(GRENOBLE[1]));
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 7000);
        const response = await fetch(url, { signal: controller.signal, referrerPolicy: "no-referrer" });
        clearTimeout(timer);
        if (!response.ok) continue;
        const payload = await response.json();
        const feature = payload?.features?.[0];
        if (!feature?.geometry?.coordinates) continue;
        const [lon, lat] = feature.geometry.coordinates.map(Number);
        if (!isGrenobleArea(lat, lon)) continue;
        return { lat, lon, approx: i > 0 };
      } catch (error) {
        console.warn("Geocoding failed for", point.name, error);
      }
    }
    return null;
  }

  function buildGeocodeAttempts(address) {
    const cleaned = address.replace(/\([^)]*\)/g, " ").replace(/\s+/g, " ").trim();
    const firstSegment = cleaned.split(",")[0].trim();
    const normalizedNumber = firstSegment.replace(/N[°º]\s*/gi, " ").replace(/\s+/g, " ").trim();
    return Array.from(new Set([address, cleaned, `${normalizedNumber}, Grenoble, France`]));
  }

  function isGrenobleArea(lat, lon) {
    return lat >= BOUNDS.minLat && lat <= BOUNDS.maxLat && lon >= BOUNDS.minLon && lon <= BOUNDS.maxLon;
  }

  function addMarker(point, lat, lon, number, approx) {
    const tracking = getTracking(point);
    const general = state.circuit === GENERAL_VIEW;
    const icon = L.divIcon({
      className: "",
      html: `<div class="point-dot ${general ? "" : `marker-${tracking.status}`}">${number}</div>`,
      iconSize: [34, 34],
      iconAnchor: [17, 17]
    });
    const marker = L.marker([lat, lon], { icon }).addTo(markerLayer);
    marker.bindPopup(buildPopup(point, approx));
    if (!general) marker.on("click", () => setActiveCard(point.name));
    state.markers.set(`${point.circuit}|${point.name}`, marker);
    if (!general) state.markers.set(point.name, marker);
  }

  function buildPopup(point, approx) {
    const wrap = document.createElement("div");
    const title = document.createElement("div");
    title.className = "popup-title";
    title.textContent = state.circuit === GENERAL_VIEW ? `Circuit ${point.circuit} · ${point.name}` : point.name;
    const address = document.createElement("div");
    address.className = "popup-address";
    address.textContent = `${point.address}${approx ? " · Repère approximatif." : ""}`;
    const link = document.createElement("a");
    link.className = "popup-link";
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.href = googleDirectionsUrl(point.address);
    link.textContent = "Itinéraire Google Maps.";
    wrap.append(title, address, link);
    return wrap;
  }

  function focusPoint(name) {
    const marker = state.markers.get(name);
    if (marker) {
      map.setView(marker.getLatLng(), 17, { animate: true });
      marker.openPopup();
      setActiveCard(name);
    }
  }

  function setActiveCard(name) {
    document.querySelectorAll(".point-card").forEach(card => card.classList.toggle("is-active", card.dataset.point === name));
    document.querySelector(`[data-point="${cssEscape(name)}"]`)?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function updateCardGeocode(name, message) {
    const node = document.querySelector(`[data-status-for="${cssEscape(name)}"]`);
    if (node) node.textContent = message;
  }

  function fitToCurrentMarkers() {
    const markers = Array.from(new Set(state.markers.values()));
    if (!markers.length) return;
    const bounds = L.featureGroup(markers).getBounds();
    if (bounds.isValid()) map.fitBounds(bounds.pad(0.18), { maxZoom: state.circuit === GENERAL_VIEW ? 14 : 15 });
  }

  function locateUser() {
    setLoading("Recherche de ta position.");
    map.locate({ setView: true, maxZoom: 16, enableHighAccuracy: true });
    map.once("locationfound", event => {
      setLoading("");
      L.circleMarker(event.latlng, { radius: 8, weight: 3, color: "#ffffff", fillColor: "#38bdf8", fillOpacity: 1 })
        .addTo(map).bindPopup("Ta position.").openPopup();
    });
    map.once("locationerror", () => {
      setLoading("Position indisponible. L’itinéraire reste utilisable.");
      setTimeout(() => setLoading(""), 4000);
    });
  }

  async function shareCurrentView() {
    const title = state.circuit === GENERAL_VIEW ? "Carte générale · AQ Grenoble" : `Circuit ${state.circuit} · AQ Grenoble`;
    const text = state.circuit === GENERAL_VIEW ? "Carte générale des points de collage." : `Suivi du circuit ${state.circuit}.`;
    try {
      if (navigator.share) await navigator.share({ title, text, url: window.location.href });
      else if (navigator.clipboard) {
        await navigator.clipboard.writeText(window.location.href);
        setLoading("Lien copié.");
        setTimeout(() => setLoading(""), 1800);
      }
    } catch (error) {
      if (error?.name !== "AbortError") console.warn(error);
    }
  }

  function googleDirectionsUrl(address) {
    const url = new URL("https://www.google.com/maps/dir/");
    url.searchParams.set("api", "1");
    url.searchParams.set("destination", address);
    url.searchParams.set("travelmode", "walking");
    return url.toString();
  }

  function setSync(text, stateName) {
    const node = document.getElementById("syncStatus");
    if (!node) return;
    node.textContent = text;
    node.className = `sync-state sync-${stateName}`;
  }

  function setLoading(text) {
    const node = document.getElementById("loading");
    if (node) node.textContent = text;
  }

  function loadJson(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); }
    catch { return fallback; }
  }

  function saveJson(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); }
    catch { /* cache facultatif */ }
  }

  function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

  function cssEscape(value) {
    if (window.CSS?.escape) return CSS.escape(value);
    return value.replace(/["\\]/g, "\\$&");
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[char]));
  }
})();
