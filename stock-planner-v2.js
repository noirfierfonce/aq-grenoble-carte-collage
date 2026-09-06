(() => {
  "use strict";

  const API = window.AQ_APP_CONFIG?.apiUrl || "";
  const ACCESS_KEY = "aq-grenoble-access-v2";
  const TRACKING_KEY = "aq-grenoble-shared-cache-v2";
  const POOL_NAME = "Stock collectif";
  const LETTERS = "ABCDEFGHIJKLM".split("");

  let points = [];
  let holders = [];
  let pool = { color: 0, bw: 0 };
  let plan = {};
  let started = false;

  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  const read = (storage, key) => { try { return storage.getItem(key) || ""; } catch (_) { return ""; } };
  const accessCode = () => read(localStorage, ACCESS_KEY) || read(sessionStorage, ACCESS_KEY);
  const isStockView = () => (new URL(location.href).searchParams.get("c") || "").toUpperCase() === "STOCK";
  const normalize = value => String(value || "").trim().toLocaleLowerCase("fr");

  function loadTracking() {
    try { return JSON.parse(localStorage.getItem(TRACKING_KEY) || "{}"); }
    catch (_) { return {}; }
  }

  function jsonp(params) {
    return new Promise((resolve, reject) => {
      if (!API) return reject(new Error("Synchronisation indisponible."));
      const callback = `__aqplannerv2_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const script = document.createElement("script");
      const timer = setTimeout(() => cleanup(new Error("Délai de synchronisation dépassé.")), 12000);
      function cleanup(error, data) {
        clearTimeout(timer);
        try { delete window[callback]; } catch (_) {}
        script.remove();
        error ? reject(error) : resolve(data);
      }
      window[callback] = data => cleanup(null, data);
      script.onerror = () => cleanup(new Error("Synchronisation indisponible."));
      const query = new URLSearchParams(params);
      query.set("callback", callback);
      query.set("_", String(Date.now()));
      script.src = `${API}?${query.toString()}`;
      document.head.appendChild(script);
    });
  }

  async function waitForAccess(maxMs = 15000) {
    const startedAt = Date.now();
    while (Date.now() - startedAt < maxMs) {
      const key = accessCode();
      if (key) return key;
      await sleep(250);
    }
    return "";
  }

  async function loadData() {
    const key = await waitForAccess();
    const pointResponse = await fetch("./data/points.json", { cache: "no-store" });
    if (!pointResponse.ok) throw new Error("Points indisponibles.");
    points = await pointResponse.json();

    if (!key) {
      holders = [];
      pool = { color: 0, bw: 0 };
      buildSuggestedPlan();
      return;
    }

    const stockPayload = await jsonp({ action: "stockSnapshot", key });
    holders = stockPayload?.ok && Array.isArray(stockPayload.holders) ? stockPayload.holders : [];
    const existingPool = holders.find(holder => normalize(holder.name) === normalize(POOL_NAME));
    pool = {
      color: Math.max(0, Number(existingPool?.color) || 0),
      bw: Math.max(0, Number(existingPool?.bw) || 0)
    };
    buildSuggestedPlan();
  }

  function needByCircuit() {
    const tracking = loadTracking();
    const needs = {};
    LETTERS.forEach(letter => needs[letter] = { color: 0, bw: 0 });
    for (const point of points) {
      const letter = String(point.circuit || "").toUpperCase();
      if (!needs[letter]) continue;
      const current = { status: "todo", capacity: null, ...(tracking[`${letter}|${point.name}`] || {}) };
      if (!["todo", "repost"].includes(current.status)) continue;
      const qty = Number(current.capacity) || 1;
      if (String(point.poster || "").includes("Couleur")) needs[letter].color += qty;
      else needs[letter].bw += qty;
    }
    return needs;
  }

  function buildSuggestedPlan() {
    const needs = needByCircuit();
    let colorLeft = pool.color;
    let bwLeft = pool.bw;
    plan = {};
    for (const letter of LETTERS) {
      const need = needs[letter] || { color: 0, bw: 0 };
      const color = Math.min(need.color, colorLeft);
      const bw = Math.min(need.bw, bwLeft);
      plan[letter] = { color, bw };
      colorLeft -= color;
      bwLeft -= bw;
    }
  }

  function totals() {
    return LETTERS.reduce((sum, letter) => {
      sum.color += Number(plan[letter]?.color) || 0;
      sum.bw += Number(plan[letter]?.bw) || 0;
      return sum;
    }, { color: 0, bw: 0 });
  }

  function remaining() {
    const used = totals();
    return { color: Math.max(0, pool.color - used.color), bw: Math.max(0, pool.bw - used.bw) };
  }

  function change(letter, type, delta) {
    const current = Number(plan[letter]?.[type]) || 0;
    const used = totals()[type];
    const spare = Math.max(0, pool[type] - used);
    let next = current + delta;
    if (delta > 0) next = current + Math.min(delta, spare);
    next = Math.max(0, next);
    plan[letter][type] = next;
    render();
  }

  async function savePool() {
    const root = document.getElementById("stockPlannerV2");
    if (!root) return;
    const status = root.querySelector("#plannerPoolStatusV2");
    const save = root.querySelector("#plannerPoolSaveV2");
    const color = Math.max(0, parseInt(root.querySelector("#plannerPoolColorV2")?.value || "0", 10) || 0);
    const bw = Math.max(0, parseInt(root.querySelector("#plannerPoolBwV2")?.value || "0", 10) || 0);
    const key = accessCode();

    if (!key) {
      status.textContent = "Code d’accès requis.";
      return;
    }

    save.disabled = true;
    save.textContent = "Enregistrement…";
    status.textContent = "";
    try {
      const payload = await jsonp({ action: "stockUpsert", key, name: POOL_NAME, color: String(color), bw: String(bw), contact: "", mutationId: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}` });
      if (!payload?.ok) throw new Error(payload?.error || "Enregistrement impossible.");
      pool = { color, bw };
      holders = Array.isArray(payload.holders) ? payload.holders : holders;
      buildSuggestedPlan();
      status.textContent = "Stock collectif enregistré.";
      render();
    } catch (error) {
      status.textContent = error?.message || "Enregistrement impossible.";
    } finally {
      const currentSave = document.getElementById("plannerPoolSaveV2");
      if (currentSave) {
        currentSave.disabled = false;
        currentSave.textContent = "Enregistrer le stock collectif.";
      }
    }
  }

  function stepper(letter, type, value, label) {
    return `<div class="planner-stepper" data-letter="${letter}" data-type="${type}"><span class="planner-step-label">${label}</span><button type="button" class="planner-step-btn" data-delta="-1" aria-label="Retirer une affiche ${label}">−</button><strong class="planner-step-value">${value}</strong><button type="button" class="planner-step-btn" data-delta="1" aria-label="Ajouter une affiche ${label}">+</button></div>`;
  }

  function ensureRoot() {
    const list = document.getElementById("pointList");
    if (!list) return null;
    let root = document.getElementById("stockPlannerV2");
    if (!root) {
      root = document.createElement("li");
      root.id = "stockPlannerV2";
      root.className = "point-card stock-planner-card";
    }
    const stockModule = document.getElementById("physicalStockModuleV3");
    if (stockModule?.parentNode === list) {
      if (stockModule.nextSibling !== root) list.insertBefore(root, stockModule.nextSibling);
    } else if (root.parentNode !== list) {
      list.prepend(root);
    }
    return root;
  }

  function render() {
    if (!isStockView()) {
      document.getElementById("stockPlannerV2")?.remove();
      return;
    }
    const root = ensureRoot();
    if (!root) return;

    const needs = needByCircuit();
    const used = totals();
    const rest = remaining();
    const fullCircuits = LETTERS.filter(letter => (plan[letter]?.color || 0) >= needs[letter].color && (plan[letter]?.bw || 0) >= needs[letter].bw).length;

    root.innerHTML = `<div class="planner-head"><div><h3>🧭 Aide à la répartition.</h3><p>L’appli propose. Vous gardez la main sur chaque quantité.</p></div></div>
      <section class="planner-pool"><div class="planner-section-title">Stock collectif à répartir.</div><p class="planner-help">Entre ce que vous avez réellement au départ. Modifiable à tout moment.</p><div class="planner-pool-grid"><label>🎨 Couleur.<input id="plannerPoolColorV2" type="number" min="0" step="1" inputmode="numeric" value="${pool.color}"></label><label>⚫ N&B.<input id="plannerPoolBwV2" type="number" min="0" step="1" inputmode="numeric" value="${pool.bw}"></label></div><button type="button" class="primary planner-save" id="plannerPoolSaveV2">Enregistrer le stock collectif.</button><div class="planner-status" id="plannerPoolStatusV2" aria-live="polite"></div></section>
      <section class="planner-summary"><div><span>Proposition.</span><strong>${fullCircuits} circuits couverts entièrement.</strong></div><div><span>À distribuer.</span><strong>🎨 ${used.color} · ⚫ ${used.bw}.</strong></div><div><span>Réserve.</span><strong>🎨 ${rest.color} · ⚫ ${rest.bw}.</strong></div></section>
      <div class="planner-section-row"><div><div class="planner-section-title">Quantités conseillées par circuit.</div><p class="planner-help">Chaque couleur a son réglage. Les boutons jaunes + et − ajustent seulement la proposition.</p></div><div class="planner-reset-wrap"><button type="button" class="planner-reset" id="plannerResetV2">↺ Revenir à la proposition auto.</button><div class="planner-reset-status" id="plannerResetStatusV2" aria-live="polite"></div></div></div>
      <div class="planner-circuits">${LETTERS.map(letter => `<div class="planner-circuit-row"><div class="planner-circuit-head"><strong>Circuit ${letter}.</strong><span>Besoin : 🎨 ${needs[letter].color} · ⚫ ${needs[letter].bw}.</span></div><div class="planner-steppers">${stepper(letter, "color", plan[letter]?.color || 0, "🎨 Couleur")}${stepper(letter, "bw", plan[letter]?.bw || 0, "⚫ N&B")}</div></div>`).join("")}</div>`;

    root.querySelector("#plannerPoolSaveV2")?.addEventListener("click", savePool);
    root.querySelector("#plannerResetV2")?.addEventListener("click", () => {
      buildSuggestedPlan();
      render();
      const message = document.getElementById("plannerResetStatusV2");
      if (message) message.textContent = "Proposition automatique rétablie.";
    });
    root.querySelectorAll(".planner-step-btn").forEach(button => button.addEventListener("click", () => {
      const node = button.closest(".planner-stepper");
      change(node.dataset.letter, node.dataset.type, Number(button.dataset.delta));
    }));
  }

  async function activate() {
    if (started) return;
    started = true;
    try {
      await loadData();
    } catch (error) {
      console.warn("Aide à la répartition", error);
      if (!points.length) {
        try { points = await fetch("./data/points.json", { cache: "no-store" }).then(r => r.json()); } catch (_) { points = []; }
      }
      buildSuggestedPlan();
    }
    render();
  }

  function start() {
    activate();
    const observer = new MutationObserver(() => {
      if (isStockView() && started && !document.getElementById("stockPlannerV2")) render();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    document.addEventListener("click", event => {
      const button = event.target.closest?.(".circuit-btn");
      if (!button) return;
      setTimeout(() => button.dataset.circuit === "STOCK" ? render() : document.getElementById("stockPlannerV2")?.remove(), 150);
    });
    document.addEventListener("visibilitychange", async () => {
      if (document.visibilityState !== "visible" || !isStockView()) return;
      try { await loadData(); } catch (_) {}
      render();
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})();