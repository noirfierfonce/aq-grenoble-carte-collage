(() => {
  "use strict";

  const API = window.AQ_APP_CONFIG?.apiUrl || "";
  const ACCESS_KEY = "aq-grenoble-access-v2";
  const TRACKING_KEY = "aq-grenoble-shared-cache-v2";
  const POOL_NAME = "Stock collectif";
  const LETTERS = "ABCDEFGHIJKLM".split("");

  let points = [];
  let holders = [];
  let plan = {};
  let pool = { color: 0, bw: 0 };
  let renderTimer = null;

  const read = (storage, key) => {
    try { return storage.getItem(key) || ""; } catch (_) { return ""; }
  };

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
      const callback = `__aqplanner_${Date.now()}_${Math.random().toString(36).slice(2)}`;
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

  async function loadData() {
    const [pointsResponse, stockPayload] = await Promise.all([
      fetch("./data/points.json", { cache: "no-store" }).then(r => {
        if (!r.ok) throw new Error("Points indisponibles.");
        return r.json();
      }),
      jsonp({ action: "stockSnapshot", key: accessCode() })
    ]);

    points = Array.isArray(pointsResponse) ? pointsResponse : [];
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
    for (const letter of LETTERS) needs[letter] = { color: 0, bw: 0 };

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
      const need = needs[letter];
      const color = Math.min(need.color, colorLeft);
      const bw = Math.min(need.bw, bwLeft);
      plan[letter] = { color, bw };
      colorLeft -= color;
      bwLeft -= bw;
    }
  }

  function totals() {
    return Object.values(plan).reduce((sum, item) => {
      sum.color += item.color;
      sum.bw += item.bw;
      return sum;
    }, { color: 0, bw: 0 });
  }

  function remaining() {
    const used = totals();
    return {
      color: Math.max(0, pool.color - used.color),
      bw: Math.max(0, pool.bw - used.bw)
    };
  }

  function change(letter, type, delta) {
    const needs = needByCircuit();
    const current = plan[letter]?.[type] || 0;
    const maxNeed = needs[letter]?.[type] || 0;
    const used = totals()[type];
    const availableExtra = Math.max(0, pool[type] - used);

    let next = current + delta;
    if (delta > 0) next = Math.min(current + Math.min(delta, availableExtra), maxNeed + 20);
    next = Math.max(0, next);
    plan[letter][type] = next;
    render();
  }

  async function savePool() {
    const root = document.getElementById("stockPlannerV1");
    if (!root) return;
    const colorInput = root.querySelector("#plannerPoolColor");
    const bwInput = root.querySelector("#plannerPoolBw");
    const save = root.querySelector("#plannerPoolSave");
    const status = root.querySelector("#plannerPoolStatus");

    const color = Math.max(0, Number.parseInt(colorInput?.value || "0", 10) || 0);
    const bw = Math.max(0, Number.parseInt(bwInput?.value || "0", 10) || 0);
    const key = accessCode();

    if (!key) {
      status.textContent = "Code d’accès requis.";
      return;
    }

    save.disabled = true;
    save.textContent = "Enregistrement…";
    status.textContent = "";

    try {
      const payload = await jsonp({
        action: "stockUpsert",
        key,
        name: POOL_NAME,
        color: String(color),
        bw: String(bw),
        contact: "",
        mutationId: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      });
      if (!payload?.ok) throw new Error(payload?.error || "Enregistrement impossible.");
      holders = Array.isArray(payload.holders) ? payload.holders : holders;
      pool = { color, bw };
      buildSuggestedPlan();
      status.textContent = "Stock collectif enregistré.";
      render();
      setTimeout(() => location.reload(), 500);
    } catch (error) {
      status.textContent = error?.message || "Enregistrement impossible.";
    } finally {
      save.disabled = false;
      save.textContent = "Enregistrer le stock collectif.";
    }
  }

  function stepper(letter, type, value, label) {
    return `
      <div class="planner-stepper" data-letter="${letter}" data-type="${type}">
        <span class="planner-step-label">${label}</span>
        <button type="button" class="planner-step-btn" data-delta="-1" aria-label="Retirer une affiche ${label}">−</button>
        <strong class="planner-step-value">${value}</strong>
        <button type="button" class="planner-step-btn" data-delta="1" aria-label="Ajouter une affiche ${label}">+</button>
      </div>`;
  }

  function render() {
    if (!isStockView()) {
      document.getElementById("stockPlannerV1")?.remove();
      return;
    }

    const list = document.getElementById("pointList");
    if (!list) return;

    let root = document.getElementById("stockPlannerV1");
    if (!root) {
      root = document.createElement("li");
      root.id = "stockPlannerV1";
      root.className = "point-card stock-planner-card";
      const stockModule = document.getElementById("physicalStockModuleV3");
      if (stockModule?.nextSibling) list.insertBefore(root, stockModule.nextSibling);
      else list.prepend(root);
    }

    const needs = needByCircuit();
    const rest = remaining();
    const used = totals();
    const fullCircuits = LETTERS.filter(letter => plan[letter].color >= needs[letter].color && plan[letter].bw >= needs[letter].bw).length;

    root.innerHTML = `
      <div class="planner-head">
        <div>
          <h3>🧭 Aide à la répartition.</h3>
          <p>L’appli propose. Vous gardez la main sur chaque quantité.</p>
        </div>
      </div>

      <section class="planner-pool">
        <div class="planner-section-title">Stock collectif à répartir.</div>
        <p class="planner-help">Entre ce que vous avez réellement au départ. Tu peux le modifier à tout moment.</p>
        <div class="planner-pool-grid">
          <label>🎨 Couleur.<input id="plannerPoolColor" type="number" min="0" step="1" inputmode="numeric" value="${pool.color}"></label>
          <label>⚫ N&B.<input id="plannerPoolBw" type="number" min="0" step="1" inputmode="numeric" value="${pool.bw}"></label>
        </div>
        <button type="button" class="primary planner-save" id="plannerPoolSave">Enregistrer le stock collectif.</button>
        <div class="planner-status" id="plannerPoolStatus" aria-live="polite"></div>
      </section>

      <section class="planner-summary">
        <div><span>Proposition.</span><strong>${fullCircuits} circuits couverts entièrement.</strong></div>
        <div><span>À distribuer.</span><strong>🎨 ${used.color} · ⚫ ${used.bw}.</strong></div>
        <div><span>Réserve après proposition.</span><strong>🎨 ${rest.color} · ⚫ ${rest.bw}.</strong></div>
      </section>

      <div class="planner-section-row">
        <div>
          <div class="planner-section-title">Quantités conseillées par circuit.</div>
          <p class="planner-help">Les boutons + et − servent seulement à ajuster la proposition. Rien n’est imposé.</p>
        </div>
        <button type="button" class="planner-reset" id="plannerReset">Revenir au conseil.</button>
      </div>

      <div class="planner-circuits">
        ${LETTERS.map(letter => `
          <div class="planner-circuit-row">
            <div class="planner-circuit-head">
              <strong>Circuit ${letter}.</strong>
              <span>Besoin : 🎨 ${needs[letter].color} · ⚫ ${needs[letter].bw}.</span>
            </div>
            <div class="planner-steppers">
              ${stepper(letter, "color", plan[letter].color, "Couleur")}
              ${stepper(letter, "bw", plan[letter].bw, "N&B")}
            </div>
          </div>`).join("")}
      </div>`;

    root.querySelector("#plannerPoolSave")?.addEventListener("click", savePool);
    root.querySelector("#plannerReset")?.addEventListener("click", () => {
      buildSuggestedPlan();
      render();
    });
    root.querySelectorAll(".planner-step-btn").forEach(button => {
      button.addEventListener("click", () => {
        const stepperNode = button.closest(".planner-stepper");
        change(stepperNode.dataset.letter, stepperNode.dataset.type, Number(button.dataset.delta));
      });
    });
  }

  function scheduleRender(delay = 120) {
    clearTimeout(renderTimer);
    renderTimer = setTimeout(render, delay);
  }

  async function start() {
    if (!accessCode()) return;
    try {
      await loadData();
      scheduleRender(0);
    } catch (error) {
      console.warn("Aide à la répartition", error);
    }

    document.addEventListener("click", event => {
      const button = event.target.closest?.(".circuit-btn");
      if (!button) return;
      setTimeout(() => {
        if (button.dataset.circuit === "STOCK") scheduleRender(0);
        else document.getElementById("stockPlannerV1")?.remove();
      }, 180);
    });

    document.addEventListener("visibilitychange", async () => {
      if (document.visibilityState !== "visible" || !isStockView()) return;
      try { await loadData(); scheduleRender(0); } catch (_) {}
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})();