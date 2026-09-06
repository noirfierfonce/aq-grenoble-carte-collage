(() => {
  "use strict";

  const API = window.AQ_APP_CONFIG?.apiUrl || "";
  const ACCESS_KEY = "aq-grenoble-access-v2";
  const TRACKING_KEY = "aq-grenoble-shared-cache-v2";
  const POOL_NAME = "Stock collectif";
  const LETTERS = "ABCDEFGHIJKLM".split("");

  let points = [];
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
      const callback = `__aqplannerv4_${Date.now()}_${Math.random().toString(36).slice(2)}`;
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
    const t = Date.now();
    while (Date.now() - t < maxMs) {
      const key = accessCode();
      if (key) return key;
      await sleep(250);
    }
    return "";
  }

  async function loadData() {
    const key = await waitForAccess();
    const response = await fetch("./data/points.json", { cache: "no-store" });
    if (!response.ok) throw new Error("Points indisponibles.");
    points = await response.json();
    if (!key) return buildSuggestedPlan();
    const payload = await jsonp({ action: "stockSnapshot", key });
    const holders = payload?.ok && Array.isArray(payload.holders) ? payload.holders : [];
    const existing = holders.find(holder => normalize(holder.name) === normalize(POOL_NAME));
    pool = { color: Math.max(0, Number(existing?.color) || 0), bw: Math.max(0, Number(existing?.bw) || 0) };
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
    let colorLeft = pool.color, bwLeft = pool.bw;
    plan = {};

    LETTERS.forEach(letter => {
      const need = needs[letter] || { color: 0, bw: 0 };
      const totalNeed = need.color + need.bw;

      // On respecte d’abord la répartition conseillée couleur / N&B.
      let color = Math.min(need.color, colorLeft);
      let bw = Math.min(need.bw, bwLeft);
      colorLeft -= color;
      bwLeft -= bw;

      // Puis on autorise le remplacement d’un type par l’autre. Si, par exemple,
      // il n’y a plus de couleur mais qu’il reste du N&B, le circuit peut quand
      // même être couvert avec le stock réellement disponible.
      let missing = Math.max(0, totalNeed - color - bw);
      if (missing && bwLeft) {
        const extra = Math.min(missing, bwLeft);
        bw += extra;
        bwLeft -= extra;
        missing -= extra;
      }
      if (missing && colorLeft) {
        const extra = Math.min(missing, colorLeft);
        color += extra;
        colorLeft -= extra;
      }

      plan[letter] = { color, bw };
    });
  }

  function totals() {
    return LETTERS.reduce((sum, letter) => {
      sum.color += Math.max(0, Number(plan[letter]?.color) || 0);
      sum.bw += Math.max(0, Number(plan[letter]?.bw) || 0);
      return sum;
    }, { color: 0, bw: 0 });
  }

  function setValue(letter, type, value, rerender = true) {
    if (!plan[letter]) plan[letter] = { color: 0, bw: 0 };
    plan[letter][type] = Math.max(0, parseInt(String(value), 10) || 0);
    if (rerender) render();
  }

  async function savePool() {
    const root = document.getElementById("stockPlannerV4");
    if (!root) return;
    const color = Math.max(0, parseInt(root.querySelector("#plannerPoolColorV4")?.value || "0", 10) || 0);
    const bw = Math.max(0, parseInt(root.querySelector("#plannerPoolBwV4")?.value || "0", 10) || 0);
    const key = accessCode();
    const status = root.querySelector("#plannerPoolStatusV4");
    const save = root.querySelector("#plannerPoolSaveV4");
    if (!key) return void (status.textContent = "Code d’accès requis.");
    save.disabled = true;
    save.textContent = "Enregistrement…";
    status.textContent = "";
    try {
      const payload = await jsonp({ action: "stockUpsert", key, name: POOL_NAME, color: String(color), bw: String(bw), contact: "", mutationId: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}` });
      if (!payload?.ok) throw new Error(payload?.error || "Enregistrement impossible.");
      pool = { color, bw };
      buildSuggestedPlan();
      render();
      document.getElementById("plannerPoolStatusV4").textContent = "Stock choisi pour ce passage enregistré.";
    } catch (error) {
      status.textContent = error?.message || "Enregistrement impossible.";
    } finally {
      const current = document.getElementById("plannerPoolSaveV4");
      if (current) { current.disabled = false; current.textContent = "Enregistrer ce stock pour le passage."; }
    }
  }

  function stepper(letter, type, value, label, icon) {
    return `<div class="planner-stepper" data-letter="${letter}" data-type="${type}">
      <div class="planner-step-label">${icon} ${label}.</div>
      <div class="planner-step-controls">
        <button type="button" class="planner-step-btn" data-step="-1" aria-label="Retirer une affiche ${label}">−</button>
        <input class="planner-step-input" type="number" min="0" step="1" inputmode="numeric" value="${value}" aria-label="Quantité ${label} pour le circuit ${letter}">
        <button type="button" class="planner-step-btn" data-step="1" aria-label="Ajouter une affiche ${label}">+</button>
      </div>
    </div>`;
  }

  function ensureRoot() {
    const list = document.getElementById("pointList");
    if (!list) return null;
    let root = document.getElementById("stockPlannerV4");
    if (!root) {
      root = document.createElement("li");
      root.id = "stockPlannerV4";
      root.className = "point-card stock-planner-card";
    }
    const stockModule = document.getElementById("physicalStockModuleV3");
    if (stockModule?.parentNode === list) {
      if (stockModule.nextSibling !== root) list.insertBefore(root, stockModule.nextSibling);
    } else if (root.parentNode !== list) list.prepend(root);
    return root;
  }

  function render() {
    if (!isStockView()) { document.getElementById("stockPlannerV4")?.remove(); return; }
    const root = ensureRoot();
    if (!root) return;
    const needs = needByCircuit();
    const used = totals();
    const needTotals = LETTERS.reduce((sum, letter) => {
      sum.color += needs[letter].color;
      sum.bw += needs[letter].bw;
      return sum;
    }, { color: 0, bw: 0 });
    needTotals.total = needTotals.color + needTotals.bw;

    const balance = { color: pool.color - used.color, bw: pool.bw - used.bw };
    const overColor = Math.max(0, -balance.color), overBw = Math.max(0, -balance.bw);
    const reserveColor = Math.max(0, balance.color), reserveBw = Math.max(0, balance.bw);
    const fullCircuits = LETTERS.filter(letter => {
      const planned = (plan[letter]?.color || 0) + (plan[letter]?.bw || 0);
      const required = needs[letter].color + needs[letter].bw;
      return planned >= required;
    }).length;
    const balanceBox = overColor || overBw
      ? `<div class="planner-balance-alert"><span>Dépassement du stock choisi.</span><strong>🎨 ${overColor} · ⚫ ${overBw} à trouver ou à retirer de la répartition.</strong></div>`
      : `<div><span>Réserve après répartition.</span><strong>🎨 ${reserveColor} · ⚫ ${reserveBw}.</strong></div>`;

    root.innerHTML = `<div class="planner-head"><div><h3>🧭 Aide à la répartition.</h3><p>L’appli calcule le besoin. Vous choisissez librement la quantité de couleur et de N&B réellement disponible pour ce passage.</p></div></div>
      <section class="planner-pool"><div class="planner-section-title">Stock à préparer pour ce passage.</div><p class="planner-help">Indique séparément ce que vous aurez réellement. Tu peux mettre 0 en couleur, 0 en N&B, ou n’importe quelle combinaison. L’un peut remplacer l’autre pour couvrir un emplacement.</p><div class="planner-pool-grid"><label>🎨 Couleur à préparer.<input id="plannerPoolColorV4" type="number" min="0" step="1" inputmode="numeric" value="${pool.color}"></label><label>⚫ N&B à préparer.<input id="plannerPoolBwV4" type="number" min="0" step="1" inputmode="numeric" value="${pool.bw}"></label></div><button type="button" class="primary planner-save" id="plannerPoolSaveV4">Enregistrer ce stock pour le passage.</button><div class="planner-status" id="plannerPoolStatusV4" aria-live="polite"></div></section>
      <section class="planner-summary"><div><span>Besoin terrain calculé.</span><strong>${needTotals.total} A3 · repère conseillé : 🎨 ${needTotals.color} · ⚫ ${needTotals.bw}.</strong></div><div><span>Proposition avec votre stock.</span><strong>${fullCircuits} circuits couverts entièrement.</strong></div><div><span>À distribuer.</span><strong>🎨 ${used.color} · ⚫ ${used.bw}.</strong></div>${balanceBox}</section>
      <div class="planner-section-row"><div><div class="planner-section-title">Quantités conseillées par circuit.</div><p class="planner-help">La couleur/N&B affichée dans le besoin reste un repère. Si un type manque, l’appli complète automatiquement avec l’autre. Tu peux ensuite modifier chaque quantité à la main.</p></div><div class="planner-reset-wrap"><button type="button" class="planner-reset" id="plannerResetV4">↺ Revenir à la proposition auto.</button><div class="planner-reset-status" id="plannerResetStatusV4" aria-live="polite"></div></div></div>
      <div class="planner-circuits">${LETTERS.map(letter => {
        const totalNeed = needs[letter].color + needs[letter].bw;
        const planned = (plan[letter]?.color || 0) + (plan[letter]?.bw || 0);
        return `<div class="planner-circuit-row"><div class="planner-circuit-head"><strong>Circuit ${letter}.</strong><span>Besoin total : ${totalNeed} A3 · repère 🎨 ${needs[letter].color} · ⚫ ${needs[letter].bw} · prévu ${planned}.</span></div><div class="planner-steppers">${stepper(letter, "color", plan[letter]?.color || 0, "Couleur", "🎨")}${stepper(letter, "bw", plan[letter]?.bw || 0, "N&B", "⚫")}</div></div>`;
      }).join("")}</div>`;
  }

  function bindGlobalControls() {
    document.addEventListener("click", event => {
      const target = event.target instanceof Element ? event.target : event.target?.parentElement;
      if (!target) return;
      if (target.closest("#plannerPoolSaveV4")) { event.preventDefault(); savePool(); return; }
      if (target.closest("#plannerResetV4")) {
        event.preventDefault();
        buildSuggestedPlan();
        render();
        const msg = document.getElementById("plannerResetStatusV4");
        if (msg) msg.textContent = "Proposition automatique rétablie selon le stock choisi.";
        return;
      }
      const button = target.closest("#stockPlannerV4 .planner-step-btn");
      if (!button) return;
      event.preventDefault();
      event.stopPropagation();
      const node = button.closest(".planner-stepper");
      if (!node) return;
      const current = Math.max(0, Number(plan[node.dataset.letter]?.[node.dataset.type]) || 0);
      setValue(node.dataset.letter, node.dataset.type, current + Number(button.dataset.step || 0));
    }, true);

    document.addEventListener("input", event => {
      const input = event.target instanceof HTMLInputElement && event.target.matches("#stockPlannerV4 .planner-step-input") ? event.target : null;
      if (!input) return;
      const node = input.closest(".planner-stepper");
      if (!node) return;
      setValue(node.dataset.letter, node.dataset.type, input.value, false);
    }, true);

    document.addEventListener("change", event => {
      const input = event.target instanceof HTMLInputElement && event.target.matches("#stockPlannerV4 .planner-step-input") ? event.target : null;
      if (!input) return;
      const node = input.closest(".planner-stepper");
      if (!node) return;
      setValue(node.dataset.letter, node.dataset.type, input.value, true);
    }, true);

    document.addEventListener("keydown", event => {
      const input = event.target instanceof HTMLInputElement && event.target.matches("#stockPlannerV4 .planner-step-input") ? event.target : null;
      if (!input || event.key !== "Enter") return;
      event.preventDefault();
      input.blur();
    }, true);
  }

  async function activate() {
    if (started) return;
    started = true;
    try { await loadData(); }
    catch (error) {
      console.warn("Aide à la répartition", error);
      if (!points.length) {
        try { points = await fetch("./data/points.json", { cache: "no-store" }).then(r => r.json()); } catch (_) { points = []; }
      }
      buildSuggestedPlan();
    }
    render();
  }

  function start() {
    bindGlobalControls();
    activate();
    const observer = new MutationObserver(() => {
      if (isStockView() && started && !document.getElementById("stockPlannerV4")) render();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    document.addEventListener("click", event => {
      const target = event.target instanceof Element ? event.target : event.target?.parentElement;
      const button = target?.closest?.(".circuit-btn");
      if (!button) return;
      setTimeout(() => button.dataset.circuit === "STOCK" ? render() : document.getElementById("stockPlannerV4")?.remove(), 150);
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})();
