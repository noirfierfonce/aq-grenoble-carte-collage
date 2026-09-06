(() => {
  "use strict";

  const API = window.AQ_APP_CONFIG?.apiUrl || "";
  const ACCESS_KEY = "aq-grenoble-access-v2";
  const TRACKING_KEY = "aq-grenoble-shared-cache-v2";
  const QUEUE_KEY = "aq-grenoble-sync-queue-v2";
  const STOCK_HASH_KEY = "aq-release-stock-hash-v1";
  const RESET_MARKER = "aq-release-reset-test-pool-v1";
  const POOL_NAME = "Stock collectif";
  const POLL_MS = 30000;
  const MIN_GAP_MS = 4000;

  let lastCheck = 0;
  let checking = false;
  let renderScheduled = false;

  const read = (storage, key) => {
    try { return storage.getItem(key) || ""; } catch (_) { return ""; }
  };

  const accessCode = () => read(localStorage, ACCESS_KEY) || read(sessionStorage, ACCESS_KEY);
  const currentView = () => (new URL(location.href).searchParams.get("c") || "ALL").toUpperCase();
  const isStockView = () => currentView() === "STOCK";

  function parseJson(value, fallback) {
    try { return JSON.parse(value || ""); } catch (_) { return fallback; }
  }

  function stable(value) {
    if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
    if (value && typeof value === "object") {
      return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stable(value[key])}`).join(",")}}`;
    }
    return JSON.stringify(value);
  }

  function jsonp(params, timeout = 12000) {
    return new Promise((resolve, reject) => {
      if (!API) return reject(new Error("Synchronisation indisponible."));
      const callback = `__aqrelease_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const script = document.createElement("script");
      const timer = setTimeout(() => cleanup(new Error("Délai de synchronisation dépassé.")), timeout);

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

  function hasPendingPointChanges() {
    const queue = parseJson(read(localStorage, QUEUE_KEY), []);
    return Array.isArray(queue) && queue.length > 0;
  }

  function editingStock() {
    const modal = document.getElementById("stockEditModalV3");
    if (modal && !modal.hidden) return true;
    const active = document.activeElement;
    return !!active?.closest?.("#stockPlannerV4");
  }

  function updateProgressVisibility() {
    const progress = document.getElementById("progress");
    if (!progress) return;
    progress.style.display = isStockView() ? "none" : "";
  }

  function parseQtyText(text) {
    const nums = String(text || "").match(/\d+/g)?.map(Number) || [];
    return { color: nums[0] || 0, bw: nums[1] || 0 };
  }

  function patchPhysicalStockPool() {
    const root = document.getElementById("physicalStockModuleV3");
    if (!root) return;

    const rows = [...root.querySelectorAll(".stock-holder-row")];
    const poolRow = rows.find(row => (row.querySelector(".stock-holder-name")?.textContent || "").trim().toLocaleLowerCase("fr") === POOL_NAME.toLocaleLowerCase("fr"));
    if (!poolRow) return;

    const pool = parseQtyText(poolRow.querySelector(".stock-holder-qty")?.textContent || "");
    const boxes = root.querySelectorAll(".stock-summary-box");
    const availableBox = boxes[0];
    const neededBox = boxes[1];
    const availableSpans = availableBox?.querySelectorAll(".stock-summary-values span") || [];
    const neededSpans = neededBox?.querySelectorAll(".stock-summary-values span") || [];

    const currentAvailable = {
      color: Number((availableSpans[0]?.textContent || "").match(/\d+/)?.[0] || 0),
      bw: Number((availableSpans[1]?.textContent || "").match(/\d+/)?.[0] || 0)
    };
    const personal = {
      color: Math.max(0, currentAvailable.color - pool.color),
      bw: Math.max(0, currentAvailable.bw - pool.bw)
    };
    const needed = {
      color: Number((neededSpans[0]?.textContent || "").match(/\d+/)?.[0] || 0),
      bw: Number((neededSpans[1]?.textContent || "").match(/\d+/)?.[0] || 0)
    };

    if (availableSpans[0]) availableSpans[0].innerHTML = `🎨 Couleur : <strong>${personal.color}</strong>.`;
    if (availableSpans[1]) availableSpans[1].innerHTML = `⚫ Noir et blanc : <strong>${personal.bw}</strong>.`;
    if (availableSpans[2]) availableSpans[2].innerHTML = `📦 Total : <strong>${personal.color + personal.bw}</strong>.`;

    const balance = root.querySelector(".stock-balance");
    if (balance) {
      const line = (label, available, required) => {
        const d = available - required;
        return d >= 0
          ? `<span class="ok">${label} : ${d} en marge après le besoin actuel.</span>`
          : `<span class="missing">${label} : il manque ${Math.abs(d)} affiche${Math.abs(d) > 1 ? "s" : ""}.</span>`;
      };
      balance.innerHTML = `${line("Couleur", personal.color, needed.color)}${line("Noir et blanc", personal.bw, needed.bw)}`;
    }

    poolRow.remove();

    const details = root.querySelector("details.stock-distribution");
    if (details) {
      const visibleRows = [...details.querySelectorAll(".stock-holder-row")].filter(row => {
        const qty = parseQtyText(row.querySelector(".stock-holder-qty")?.textContent || "");
        return qty.color > 0 || qty.bw > 0;
      });
      const spans = details.querySelectorAll("summary span");
      if (spans[1]) spans[1].textContent = `${visibleRows.length} emplacement${visibleRows.length > 1 ? "s" : ""}.`;
    }
  }

  function scheduleUiPatch() {
    if (renderScheduled) return;
    renderScheduled = true;
    requestAnimationFrame(() => {
      renderScheduled = false;
      updateProgressVisibility();
      patchPhysicalStockPool();
    });
  }

  async function resetKnownTestPoolOnce() {
    if (!API || !accessCode() || read(localStorage, RESET_MARKER)) return;
    try {
      const snapshot = await jsonp({ action: "stockSnapshot", key: accessCode() });
      const holders = Array.isArray(snapshot?.holders) ? snapshot.holders : [];
      const pool = holders.find(holder => String(holder.name || "").trim().toLocaleLowerCase("fr") === POOL_NAME.toLocaleLowerCase("fr"));
      if (pool && Number(pool.color) === 20 && Number(pool.bw) === 10) {
        const result = await jsonp({
          action: "stockUpsert",
          key: accessCode(),
          name: POOL_NAME,
          color: "0",
          bw: "0",
          contact: "",
          mutationId: `release-reset-${Date.now()}`
        });
        if (!result?.ok) throw new Error(result?.error || "Réinitialisation impossible.");
      }
      try { localStorage.setItem(RESET_MARKER, "1"); } catch (_) {}
    } catch (error) {
      console.warn("Réinitialisation du stock collectif de test", error);
    }
  }

  async function refreshSharedState(force = false) {
    if (!API || !accessCode() || !navigator.onLine || checking || editingStock()) return;
    const now = Date.now();
    if (!force && now - lastCheck < MIN_GAP_MS) return;
    checking = true;
    lastCheck = now;

    try {
      if (!hasPendingPointChanges()) {
        const remote = await jsonp({ action: "snapshot", key: accessCode() });
        if (remote?.ok && remote.tracking && typeof remote.tracking === "object") {
          const local = parseJson(read(localStorage, TRACKING_KEY), {});
          if (stable(remote.tracking) !== stable(local)) {
            try { localStorage.setItem(TRACKING_KEY, JSON.stringify(remote.tracking)); } catch (_) {}
            location.reload();
            return;
          }
        }
      }

      if (isStockView()) {
        const stock = await jsonp({ action: "stockSnapshot", key: accessCode() });
        const holders = Array.isArray(stock?.holders) ? stock.holders : [];
        const hash = stable(holders.map(holder => ({
          name: holder.name || "",
          color: Number(holder.color) || 0,
          bw: Number(holder.bw) || 0,
          contact: holder.contact || "",
          updated: holder.updated || ""
        })));
        const previous = read(sessionStorage, STOCK_HASH_KEY);
        try { sessionStorage.setItem(STOCK_HASH_KEY, hash); } catch (_) {}
        if (previous && previous !== hash) {
          location.reload();
          return;
        }
      }
    } catch (error) {
      console.warn("Rafraîchissement partagé", error);
    } finally {
      checking = false;
    }
  }

  function start() {
    scheduleUiPatch();
    resetKnownTestPoolOnce().finally(() => refreshSharedState(true));

    const observer = new MutationObserver(scheduleUiPatch);
    observer.observe(document.body, { childList: true, subtree: true });

    document.addEventListener("click", event => {
      if (!event.target.closest?.(".circuit-btn")) return;
      setTimeout(() => {
        scheduleUiPatch();
        refreshSharedState(true);
      }, 450);
    }, true);

    window.addEventListener("focus", () => refreshSharedState(true));
    window.addEventListener("online", () => refreshSharedState(true));
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") refreshSharedState(true);
    });

    setInterval(() => {
      if (document.visibilityState === "visible") refreshSharedState(false);
    }, POLL_MS);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})();
