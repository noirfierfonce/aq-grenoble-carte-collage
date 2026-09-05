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
    { value: "vandalized", label: "Vandalisé", icon: "!" },
    { value: "covered", label: "Recouvert", icon: "↻" }
  ];

  const GENERAL_VIEW = "ALL";
  const GRENOBLE = [45.1885, 5.7245];
  const CACHE_KEY = "aq-grenoble-geocode-v2";
  const TRACKING_KEY = "aq-grenoble-tracking-v1";
  const BOUNDS = { minLat: 45.08, maxLat: 45.30, minLon: 5.55, maxLon: 5.95 };

  const state = {
    points: [],
    circuit: getInitialCircuit(),
    markers: new Map(),
    cache: loadJson(CACHE_KEY, {}),
    tracking: loadJson(TRACKING_KEY, {}),
    renderToken: 0
  };

  const map = L.map("map", {
    zoomControl: true,
    attributionControl: true
  }).setView(GRENOBLE, 13);

  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap contributors"
  }).addTo(map);

  const markerLayer = L.layerGroup().addTo(map);

  document.addEventListener("DOMContentLoaded", init);

  async function init() {
    buildCircuitNav();
    bindControls();

    try {
      const response = await fetch("./data/points.json", { cache: "no-store" });
      if (!response.ok) throw new Error("Données indisponibles.");
      state.points = await response.json();
      await showCircuit(state.circuit);
    } catch (error) {
      setLoading("Impossible de charger les points. Réessaie dans quelques instants.");
      console.error(error);
    }
  }

  function getInitialCircuit() {
    const requested = new URLSearchParams(window.location.search).get("c");
    const normalized = (requested || GENERAL_VIEW).toUpperCase();
    if (normalized === GENERAL_VIEW) return GENERAL_VIEW;
    return CIRCUITS[normalized] ? normalized : GENERAL_VIEW;
  }

  function buildCircuitNav() {
    const nav = document.getElementById("circuitNav");

    const allButton = document.createElement("button");
    allButton.type = "button";
    allButton.className = "circuit-btn";
    allButton.innerHTML = `<span class="circuit-letter">◎</span><span class="circuit-label">Tous</span>`;
    allButton.title = "Carte générale · 209 points";
    allButton.dataset.circuit = GENERAL_VIEW;
    allButton.addEventListener("click", () => showCircuit(GENERAL_VIEW));
    nav.appendChild(allButton);

    Object.keys(CIRCUITS).forEach(letter => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "circuit-btn";
      button.innerHTML = `<span class="circuit-letter">${letter}</span><span class="circuit-label">Circuit ${letter}</span>`;
      button.title = `Circuit ${letter} · ${CIRCUITS[letter].zone}`;
      button.dataset.circuit = letter;
      button.addEventListener("click", () => showCircuit(letter));
      nav.appendChild(button);
    });
  }

  function bindControls() {
    document.getElementById("locateBtn").addEventListener("click", locateUser);
    document.getElementById("shareBtn").addEventListener("click", shareCurrentCircuit);
  }

  async function showCircuit(letter) {
    if (letter !== GENERAL_VIEW && !CIRCUITS[letter]) return;

    state.circuit = letter;
    state.renderToken += 1;
    const token = state.renderToken;

    const url = new URL(window.location.href);
    url.searchParams.set("c", letter);
    history.replaceState(null, "", url);

    document.querySelectorAll(".circuit-btn").forEach(btn => {
      const active = btn.dataset.circuit === letter;
      btn.setAttribute("aria-current", active ? "true" : "false");
      if (active) btn.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    });

    const points = letter === GENERAL_VIEW
      ? state.points
      : state.points.filter(point => point.circuit === letter);

    updateHeader(letter, points);
    markerLayer.clearLayers();
    state.markers.clear();
    map.setView(GRENOBLE, letter === GENERAL_VIEW ? 12 : 13);

    if (letter === GENERAL_VIEW) {
      renderGeneralOverview();
    } else {
      renderList(points);
    }

    const cached = points.filter(point => state.cache[point.address]);
    cached.forEach((point, index) => {
      const cachedPosition = state.cache[point.address];
      const pointIndex = letter === GENERAL_VIEW ? point.circuit : points.findIndex(p => p.name === point.name) + 1;
      addMarker(point, cachedPosition.lat, cachedPosition.lon, pointIndex, cachedPosition.approx);
      if (letter !== GENERAL_VIEW) {
        updateCardGeocode(point.name, cachedPosition.approx ? "Repère approximatif." : "Repère chargé.");
      }
    });

    fitToCurrentMarkers();

    const missing = points.filter(point => !state.cache[point.address]);
    if (!missing.length) {
      setLoading("");
      return;
    }

    if (letter === GENERAL_VIEW) {
      await geocodeGeneralView(missing, token, points.length, cached.length);
    } else {
      await geocodeCircuitView(missing, token, points, cached.length);
    }

    if (token === state.renderToken) setLoading("");
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
        updateCardGeocode(point.name, location.approx ? "Repère approximatif. Utilise Google Maps pour l’adresse exacte." : "Repère placé.");
      } else {
        updateCardGeocode(point.name, "Repère non placé. L’itinéraire Google Maps reste disponible.");
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

  function updateHeader(letter, points) {
    const general = letter === GENERAL_VIEW;
    const shareBtn = document.getElementById("shareBtn");
    const hint = document.querySelector(".hint");

    if (general) {
      document.getElementById("subtitle").textContent = "Vue générale · 209 points · 13 circuits.";
      document.getElementById("circuitBadge").textContent = "Carte générale.";
      document.getElementById("zoneTitle").textContent = "Grenoble · tous les circuits.";
      document.getElementById("count").textContent = `${points.length} points.`;
      shareBtn.textContent = "↗ Partager la carte générale.";
      hint.textContent = "Vue d’ensemble des 209 points. Touche un circuit ci-dessous pour passer au suivi terrain détaillé.";
      document.getElementById("progress").innerHTML = `
        <div class="progress-top"><strong>209 points officiels.</strong><span>13 circuits.</span></div>
        <div class="progress-bar" aria-label="Carte générale"><span style="width:100%"></span></div>
      `;
      document.title = "Carte générale · Collage AQ Grenoble";
      return;
    }

    const info = CIRCUITS[letter];
    document.getElementById("subtitle").textContent = `Circuit ${letter} · ${info.zone}.`;
    document.getElementById("circuitBadge").textContent = `Circuit ${letter}.`;
    document.getElementById("zoneTitle").textContent = info.zone;
    document.getElementById("count").textContent = `${points.length} points.`;
    shareBtn.textContent = "↗ Partager ce circuit.";
    hint.textContent = "Chaque point est dans sa propre case. Ouvre l’itinéraire, indique son état et, lors du repérage, le nombre d’affiches possibles.";
    updateProgress(points);
    document.title = `Circuit ${letter} · Carte collage AQ Grenoble`;
  }

  function updateProgress(points) {
    const progress = document.getElementById("progress");
    if (!progress) return;
    const done = points.filter(point => getTracking(point).status === "done").length;
    const remaining = points.length - done;
    const percent = points.length ? Math.round((done / points.length) * 100) : 0;
    progress.innerHTML = `
      <div class="progress-top"><strong>${done} / ${points.length} faits.</strong><span>${remaining} restant${remaining > 1 ? "s" : ""}.</span></div>
      <div class="progress-bar" aria-label="Progression ${percent}%"><span style="width:${percent}%"></span></div>
    `;
  }

  function renderGeneralOverview() {
    const list = document.getElementById("pointList");
    list.replaceChildren();

    Object.entries(CIRCUITS).forEach(([letter, info]) => {
      const li = document.createElement("li");
      li.className = "point-card";

      const top = document.createElement("div");
      top.className = "point-top";

      const name = document.createElement("div");
      name.className = "point-name";
      name.textContent = `Circuit ${letter} · ${info.zone}`;

      const count = document.createElement("span");
      count.className = "poster";
      count.textContent = `${info.count} points`;
      top.append(name, count);

      const actions = document.createElement("div");
      actions.className = "card-actions";

      const open = document.createElement("button");
      open.type = "button";
      open.className = "primary";
      open.innerHTML = `<span class="action-icon">→</span><span>Ouvrir le circuit ${letter}.</span>`;
      open.addEventListener("click", () => showCircuit(letter));

      const share = document.createElement("button");
      share.type = "button";
      share.innerHTML = `<span class="action-icon">↗</span><span>Lien du circuit.</span>`;
      share.addEventListener("click", async () => {
        const url = new URL(window.location.href);
        url.searchParams.set("c", letter);
        try {
          if (navigator.clipboard) {
            await navigator.clipboard.writeText(url.toString());
            setLoading(`Lien du circuit ${letter} copié.`);
            setTimeout(() => setLoading(""), 1800);
          }
        } catch (error) {
          console.warn(error);
        }
      });

      actions.append(open, share);
      li.append(top, actions);
      list.appendChild(li);
    });
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
      statusTitle.innerHTML = `<strong>État du point.</strong><span>Choisis une case.</span>`;

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
      capacityTitle.innerHTML = `<strong>Capacité constatée.</strong><span>Nombre d’affiches possibles.</span>`;

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

      const localNote = document.createElement("div");
      localNote.className = "local-note";
      localNote.textContent = "Suivi enregistré sur ce téléphone.";

      tracker.append(statusTitle, statusGrid, capacityBlock, localNote);

      const geocodeStatus = document.createElement("div");
      geocodeStatus.className = "geocode-status";
      geocodeStatus.dataset.statusFor = point.name;
      geocodeStatus.textContent = state.cache[point.address] ? "Repère chargé." : "Placement du repère en cours.";

      li.append(top, address, actions, tracker, geocodeStatus);
      list.appendChild(li);
    });
  }

  function trackingId(point) {
    return `${point.circuit}|${point.name}`;
  }

  function getTracking(point) {
    return { status: "todo", capacity: null, ...(state.tracking[trackingId(point)] || {}) };
  }

  function setPointStatus(point, status) {
    const id = trackingId(point);
    state.tracking[id] = { ...getTracking(point), status };
    saveJson(TRACKING_KEY, state.tracking);
    refreshPointTracking(point);
  }

  function setPointCapacity(point, capacity) {
    const id = trackingId(point);
    const current = getTracking(point);
    state.tracking[id] = { ...current, capacity: current.capacity === capacity ? null : capacity };
    saveJson(TRACKING_KEY, state.tracking);
    refreshPointTracking(point);
  }

  function refreshPointTracking(point) {
    const card = document.querySelector(`[data-point="${cssEscape(point.name)}"]`);
    if (!card) return;
    const tracking = getTracking(point);

    STATUS_OPTIONS.forEach(option => {
      const button = card.querySelector(`.status-btn[data-value="${option.value}"]`);
      button?.setAttribute("aria-pressed", tracking.status === option.value ? "true" : "false");
    });

    card.querySelectorAll(".capacity-btn").forEach((button, index) => {
      button.setAttribute("aria-pressed", tracking.capacity === index + 1 ? "true" : "false");
    });

    card.className = `point-card status-${tracking.status}${card.classList.contains("is-active") ? " is-active" : ""}`;
    const points = state.points.filter(p => p.circuit === state.circuit);
    updateProgress(points);
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
    } else {
      document.querySelector(`[data-point="${cssEscape(name)}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }

  function setActiveCard(name) {
    document.querySelectorAll(".point-card").forEach(card => {
      card.classList.toggle("is-active", card.dataset.point === name);
    });
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
      L.circleMarker(event.latlng, {
        radius: 8,
        weight: 3,
        color: "#ffffff",
        fillColor: "#38bdf8",
        fillOpacity: 1
      }).addTo(map).bindPopup("Ta position.").openPopup();
    });

    map.once("locationerror", () => {
      setLoading("Position indisponible. Vérifie l’autorisation GPS du navigateur.");
      setTimeout(() => setLoading(""), 4000);
    });
  }

  async function shareCurrentCircuit() {
    const url = window.location.href;
    const general = state.circuit === GENERAL_VIEW;
    const data = general
      ? { title: "Carte générale · AQ Grenoble", text: "Carte générale des 209 points de collage · Grenoble.", url }
      : { title: `Circuit ${state.circuit} · AQ Grenoble`, text: `Carte du circuit ${state.circuit} · ${CIRCUITS[state.circuit].zone}.`, url };

    try {
      if (navigator.share) {
        await navigator.share(data);
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(url);
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

  function loadJson(key, fallback) {
    try {
      return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback));
    } catch {
      return fallback;
    }
  }

  function saveJson(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // L’interface reste utilisable même si le stockage local est indisponible.
    }
  }

  function setLoading(text) {
    document.getElementById("loading").textContent = text;
  }

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function cssEscape(value) {
    if (window.CSS?.escape) return CSS.escape(value);
    return value.replace(/["\\]/g, "\\$&");
  }
})();