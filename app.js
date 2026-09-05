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

  const GRENOBLE = [45.1885, 5.7245];
  const CACHE_KEY = "aq-grenoble-geocode-v2";
  const BOUNDS = { minLat: 45.08, maxLat: 45.30, minLon: 5.55, maxLon: 5.95 };

  const state = {
    points: [],
    circuit: getInitialCircuit(),
    markers: new Map(),
    cache: loadCache(),
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
    const normalized = (requested || "A").toUpperCase();
    return CIRCUITS[normalized] ? normalized : "A";
  }

  function buildCircuitNav() {
    const nav = document.getElementById("circuitNav");
    Object.keys(CIRCUITS).forEach(letter => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "circuit-btn";
      button.textContent = letter;
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
    if (!CIRCUITS[letter]) return;

    state.circuit = letter;
    state.renderToken += 1;
    const token = state.renderToken;

    const url = new URL(window.location.href);
    url.searchParams.set("c", letter);
    history.replaceState(null, "", url);

    document.querySelectorAll(".circuit-btn").forEach(btn => {
      btn.setAttribute("aria-current", btn.dataset.circuit === letter ? "true" : "false");
    });

    const circuitPoints = state.points.filter(point => point.circuit === letter);
    updateHeader(letter, circuitPoints.length);
    renderList(circuitPoints);
    markerLayer.clearLayers();
    state.markers.clear();
    map.setView(GRENOBLE, 13);

    const cached = circuitPoints.filter(point => state.cache[point.address]);
    cached.forEach((point, index) => {
      const cachedPosition = state.cache[point.address];
      addMarker(point, cachedPosition.lat, cachedPosition.lon, index + 1, cachedPosition.approx);
      updateCardGeocode(point.name, cachedPosition.approx ? "Repère approximatif." : "Repère chargé.");
    });

    fitToCurrentMarkers();

    const missing = circuitPoints.filter(point => !state.cache[point.address]);
    if (!missing.length) {
      setLoading("");
      return;
    }

    setLoading(`Placement des repères : ${cached.length}/${circuitPoints.length}.`);
    for (let i = 0; i < missing.length; i += 1) {
      if (token !== state.renderToken) return;

      const point = missing[i];
      const pointIndex = circuitPoints.findIndex(p => p.name === point.name) + 1;
      const location = await geocodePoint(point);

      if (token !== state.renderToken) return;

      if (location) {
        state.cache[point.address] = location;
        saveCache();
        addMarker(point, location.lat, location.lon, pointIndex, location.approx);
        updateCardGeocode(point.name, location.approx ? "Repère approximatif. Utilise Google Maps pour l’adresse exacte." : "Repère placé.");
      } else {
        updateCardGeocode(point.name, "Repère non placé. L’itinéraire Google Maps reste disponible.");
      }

      const done = cached.length + i + 1;
      setLoading(`Placement des repères : ${Math.min(done, circuitPoints.length)}/${circuitPoints.length}.`);
      fitToCurrentMarkers();

      await sleep(320);
    }

    setLoading("");
  }

  function updateHeader(letter, count) {
    const info = CIRCUITS[letter];
    document.getElementById("subtitle").textContent = `Circuit ${letter} · ${info.zone}.`;
    document.getElementById("circuitBadge").textContent = `Circuit ${letter}.`;
    document.getElementById("zoneTitle").textContent = info.zone;
    document.getElementById("count").textContent = `${count} points.`;
    document.title = `Circuit ${letter} · Carte collage AQ Grenoble`;
  }

  function renderList(points) {
    const list = document.getElementById("pointList");
    list.replaceChildren();

    points.forEach((point, index) => {
      const li = document.createElement("li");
      li.className = "point-card";
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
      route.textContent = "Itinéraire.";

      const zoom = document.createElement("button");
      zoom.type = "button";
      zoom.textContent = "Voir sur la carte.";
      zoom.addEventListener("click", () => focusPoint(point.name));

      actions.append(route, zoom);

      const status = document.createElement("div");
      status.className = "geocode-status";
      status.dataset.statusFor = point.name;
      status.textContent = state.cache[point.address] ? "Repère chargé." : "Placement du repère en cours.";

      li.append(top, address, actions, status);
      list.appendChild(li);
    });
  }

  async function geocodePoint(point) {
    const attempts = buildGeocodeAttempts(point.address);

    for (let i = 0; i < attempts.length; i += 1) {
      try {
        const query = attempts[i];
        const url = new URL("https://photon.komoot.io/api/");
        url.searchParams.set("q", query);
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
    const cleaned = address
      .replace(/\([^)]*\)/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    const firstSegment = cleaned.split(",")[0].trim();
    const normalizedNumber = firstSegment.replace(/N[°º]\s*/gi, " ").replace(/\s+/g, " ").trim();

    return Array.from(new Set([
      address,
      cleaned,
      `${normalizedNumber}, Grenoble, France`
    ]));
  }

  function isGrenobleArea(lat, lon) {
    return lat >= BOUNDS.minLat && lat <= BOUNDS.maxLat && lon >= BOUNDS.minLon && lon <= BOUNDS.maxLon;
  }

  function addMarker(point, lat, lon, number, approx) {
    const icon = L.divIcon({
      className: "",
      html: `<div class="point-dot">${number}</div>`,
      iconSize: [30, 30],
      iconAnchor: [15, 15]
    });

    const marker = L.marker([lat, lon], { icon }).addTo(markerLayer);
    marker.bindPopup(buildPopup(point, approx));
    marker.on("click", () => setActiveCard(point.name));
    state.markers.set(point.name, marker);
  }

  function buildPopup(point, approx) {
    const wrap = document.createElement("div");

    const title = document.createElement("div");
    title.className = "popup-title";
    title.textContent = point.name;

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
      const card = document.querySelector(`[data-point="${cssEscape(name)}"]`);
      card?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }

  function setActiveCard(name) {
    document.querySelectorAll(".point-card").forEach(card => {
      card.classList.toggle("is-active", card.dataset.point === name);
    });
    const card = document.querySelector(`[data-point="${cssEscape(name)}"]`);
    card?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function updateCardGeocode(name, message) {
    const node = document.querySelector(`[data-status-for="${cssEscape(name)}"]`);
    if (node) node.textContent = message;
  }

  function fitToCurrentMarkers() {
    const markers = Array.from(state.markers.values());
    if (!markers.length) return;
    const group = L.featureGroup(markers);
    const bounds = group.getBounds();
    if (bounds.isValid()) map.fitBounds(bounds.pad(0.18), { maxZoom: 15 });
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
    const data = {
      title: `Circuit ${state.circuit} · AQ Grenoble`,
      text: `Carte du circuit ${state.circuit} · ${CIRCUITS[state.circuit].zone}.`,
      url
    };

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

  function loadCache() {
    try {
      return JSON.parse(localStorage.getItem(CACHE_KEY) || "{}");
    } catch {
      return {};
    }
  }

  function saveCache() {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(state.cache));
    } catch {
      // The map still works without cache.
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
