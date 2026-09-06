(() => {
  "use strict";

  const ACCESS_KEY = "aq-grenoble-access-v2";
  const TRACKING_KEY = "aq-grenoble-shared-cache-v2";
  const HOLDER_NAME_KEY = "aq-grenoble-stock-holder-v1";
  const API = window.AQ_APP_CONFIG?.apiUrl || "";

  let pointsPromise = null;
  let holders = [];
  let refreshing = false;
  let renderQueued = false;

  function readStorage(storage, key) {
    try { return storage.getItem(key) || ""; } catch (_) { return ""; }
  }

  function accessCode() {
    return readStorage(localStorage, ACCESS_KEY) || readStorage(sessionStorage, ACCESS_KEY);
  }

  function loadTracking() {
    try { return JSON.parse(localStorage.getItem(TRACKING_KEY) || "{}"); }
    catch (_) { return {}; }
  }

  function loadPoints() {
    if (!pointsPromise) {
      pointsPromise = fetch("./data/points.json", { cache: "no-store" })
        .then(response => {
          if (!response.ok) throw new Error("Points indisponibles.");
          return response.json();
        });
    }
    return pointsPromise;
  }

  function isStockView() {
    return (new URL(location.href).searchParams.get("c") || "").toUpperCase() === "STOCK";
  }

  function trackingFor(point, tracking) {
    return { status: "todo", capacity: null, ...(tracking[`${point.circuit}|${point.name}`] || {}) };
  }

  function neededStock(points, tracking) {
    let color = 0;
    let bw = 0;
    points.forEach(point => {
      const current = trackingFor(point, tracking);
      if (!["todo", "repost"].includes(current.status)) return;
      const qty = Number(current.capacity) || 1;
      if (String(point.poster || "").includes("Couleur")) color += qty;
      else bw += qty;
    });
    return { color, bw, total: color + bw };
  }

  function availableStock() {
    return holders.reduce((sum, holder) => {
      sum.color += Math.max(0, Number(holder.color) || 0);
      sum.bw += Math.max(0, Number(holder.bw) || 0);
      return sum;
    }, { color: 0, bw: 0 });
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function formatUpdated(value) {
    if (!value) return "Mise à jour non datée.";
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) {
      return `Mis à jour le ${new Intl.DateTimeFormat("fr-FR", {
        day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit"
      }).format(date)}.`;
    }
    return `Mis à jour : ${String(value)}.`;
  }

  function jsonp(params) {
    return new Promise((resolve, reject) => {
      if (!API) return reject(new Error("Synchronisation indisponible."));
      const callback = `__aqstock_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const script = document.createElement("script");
      const timer = setTimeout(() => cleanup(new Error("Délai de synchronisation dépassé.")), 10000);

      function cleanup(error, data) {
        clearTimeout(timer);
        try { delete window[callback]; } catch (_) {}
        script.remove();
        error ? reject(error) : resolve(data);
      }

      window[callback] = data => cleanup(null, data);
      script.onerror = () => cleanup(new Error("Synchronisation du stock indisponible."));

      const query = new URLSearchParams(params);
      query.set("callback", callback);
      query.set("_", String(Date.now()));
      script.src = `${API}?${query.toString()}`;
      document.head.appendChild(script);
    });
  }

  async function refreshHolders() {
    if (refreshing || !API || !accessCode()) return;
    refreshing = true;
    try {
      const payload = await jsonp({ action: "stockSnapshot", key: accessCode() });
      if (payload?.ok) holders = Array.isArray(payload.holders) ? payload.holders : [];
    } catch (error) {
      console.warn("Stock physique", error);
    } finally {
      refreshing = false;
      queueRender();
    }
  }

  function balanceLine(label, available, needed) {
    const difference = available - needed;
    if (difference >= 0) {
      return `<span class="ok">${escapeHtml(label)} : ${difference} en marge après le besoin actuel.</span>`;
    }
    return `<span class="missing">${escapeHtml(label)} : il manque ${Math.abs(difference)} affiche${Math.abs(difference) > 1 ? "s" : ""}.</span>`;
  }

  async function renderStockModule() {
    fixLabels();

    const progress = document.getElementById("progress");
    if (!isStockView()) {
      if (progress) progress.style.display = "";
      document.getElementById("physicalStockModule")?.remove();
      return;
    }

    if (progress) progress.style.display = "none";

    const list = document.getElementById("pointList");
    if (!list) return;

    let root = document.getElementById("physicalStockModule");
    if (!root) {
      root = document.createElement("li");
      root.id = "physicalStockModule";
      root.className = "point-card stock-live-card";
      list.prepend(root);
    } else if (list.firstElementChild !== root) {
      list.prepend(root);
    }

    try {
      const points = await loadPoints();
      if (!isStockView()) return;
      const needed = neededStock(points, loadTracking());
      const available = availableStock();
      const totalAvailable = available.color + available.bw;

      document.getElementById("subtitle").textContent = "Disponible · nécessaire · répartition.";
      document.getElementById("zoneTitle").textContent = "Stock des affiches.";
      document.getElementById("count").textContent = `${needed.total} nécessaires.`;
      document.querySelector(".hint").textContent = "Disponible = stock physique déclaré. Nécessaire = besoin calculé automatiquement à partir des circuits.";

      const holderRows = holders.length
        ? holders.map(holder => `
          <div class="stock-holder-row">
            <span class="stock-holder-name">${escapeHtml(holder.name)}</span>
            <span class="stock-holder-qty">🎨 ${Math.max(0, Number(holder.color) || 0)} · ⚫ ${Math.max(0, Number(holder.bw) || 0)}</span>
            <span class="stock-holder-time">${escapeHtml(formatUpdated(holder.updated))}</span>
          </div>`).join("")
        : '<div class="stock-empty">Aucun stock physique n’est encore renseigné.</div>';

      root.innerHTML = `
        <div class="stock-live-head">
          <div>
            <h3 class="stock-live-title">📦 Stock des affiches.</h3>
            <p class="stock-live-sub">Une vue commune, même quand les affiches sont dispersées chez plusieurs personnes.</p>
          </div>
        </div>
        <div class="stock-summary-grid">
          <div class="stock-summary-box available">
            <span class="stock-summary-label">Disponible.</span>
            <div class="stock-summary-values">
              <span>🎨 Couleur : <strong>${available.color}</strong>.</span>
              <span>⚫ Noir et blanc : <strong>${available.bw}</strong>.</span>
              <span>📦 Total : <strong>${totalAvailable}</strong>.</span>
            </div>
          </div>
          <div class="stock-summary-box">
            <span class="stock-summary-label">Nécessaire pour les collages.</span>
            <div class="stock-summary-values">
              <span>🎨 Couleur : <strong>${needed.color}</strong>.</span>
              <span>⚫ Noir et blanc : <strong>${needed.bw}</strong>.</span>
              <span>📦 Total : <strong>${needed.total}</strong>.</span>
            </div>
          </div>
        </div>
        <div class="stock-balance">
          ${balanceLine("Couleur", available.color, needed.color)}
          ${balanceLine("Noir et blanc", available.bw, needed.bw)}
        </div>
        <button type="button" class="primary stock-update-btn" id="stockUpdateBtn">Mettre à jour mon stock.</button>
        <details class="stock-distribution">
          <summary><span>Répartition du stock.</span><span>${holders.length} emplacement${holders.length > 1 ? "s" : ""}.</span></summary>
          <div class="stock-holder-list">${holderRows}</div>
        </details>
        <p class="stock-module-note">Chaque personne peut mettre à jour ce qu’elle a réellement chez elle. Le total disponible se recalcule automatiquement.</p>
      `;

      root.querySelector("#stockUpdateBtn")?.addEventListener("click", openEditor);
    } catch (error) {
      console.warn(error);
      root.innerHTML = '<div class="stock-empty">Impossible de charger le module de stock pour le moment.</div>';
    }
  }

  function fixLabels() {
    const label = document.querySelector(".stat-card.accent .stat-label");
    if (label && label.textContent !== "📦 Besoin pour les collages") label.textContent = "📦 Besoin pour les collages";

    const meta = document.getElementById("statStockMeta");
    if (meta && meta.textContent !== "couleur + N&B nécessaires.") meta.textContent = "couleur + N&B nécessaires.";

    document.querySelectorAll(".general-stock-card .point-name").forEach(node => {
      if (node.textContent !== "📦 Besoin pour les collages.") node.textContent = "📦 Besoin pour les collages.";
    });
    document.querySelectorAll(".general-stock-card .stock-open-btn").forEach(node => {
      if (node.textContent !== "Ouvrir le stock des affiches.") node.textContent = "Ouvrir le stock des affiches.";
    });
  }

  function ensureEditor() {
    let modal = document.getElementById("stockEditModal");
    if (modal) return modal;

    modal = document.createElement("div");
    modal.id = "stockEditModal";
    modal.className = "stock-edit-modal";
    modal.hidden = true;
    modal.innerHTML = `
      <form class="stock-edit-card" id="stockEditForm">
        <h2>Mettre à jour mon stock.</h2>
        <p>Indique ce que tu as physiquement chez toi ou dans ton point de stockage.</p>
        <label>Nom ou repère.
          <input id="stockHolderName" maxlength="60" autocomplete="name" required placeholder="Ex. Nox, local, équipe B.">
        </label>
        <div class="stock-edit-grid">
          <label>Affiches couleur.
            <input id="stockHolderColor" type="number" min="0" step="1" inputmode="numeric" value="0" required>
          </label>
          <label>Affiches N&B.
            <input id="stockHolderBw" type="number" min="0" step="1" inputmode="numeric" value="0" required>
          </label>
        </div>
        <div class="stock-edit-error" id="stockEditError"></div>
        <div class="stock-edit-actions">
          <button type="button" id="stockEditCancel">Annuler.</button>
          <button type="submit" class="primary" id="stockEditSave">Enregistrer.</button>
        </div>
      </form>
    `;

    document.body.appendChild(modal);
    modal.querySelector("#stockEditCancel")?.addEventListener("click", () => { modal.hidden = true; });
    modal.addEventListener("click", event => { if (event.target === modal) modal.hidden = true; });
    modal.querySelector("#stockEditForm")?.addEventListener("submit", saveHolder);
    return modal;
  }

  function openEditor() {
    const modal = ensureEditor();
    const savedName = readStorage(localStorage, HOLDER_NAME_KEY);
    const existing = holders.find(holder => String(holder.name || "").toLocaleLowerCase("fr") === savedName.toLocaleLowerCase("fr"));
    modal.querySelector("#stockHolderName").value = savedName || "";
    modal.querySelector("#stockHolderColor").value = String(existing?.color ?? 0);
    modal.querySelector("#stockHolderBw").value = String(existing?.bw ?? 0);
    modal.querySelector("#stockEditError").textContent = "";
    modal.hidden = false;
    setTimeout(() => modal.querySelector("#stockHolderName")?.focus(), 30);
  }

  async function saveHolder(event) {
    event.preventDefault();
    const modal = ensureEditor();
    const errorBox = modal.querySelector("#stockEditError");
    const saveButton = modal.querySelector("#stockEditSave");
    const name = modal.querySelector("#stockHolderName").value.trim();
    const color = Math.max(0, Number.parseInt(modal.querySelector("#stockHolderColor").value, 10) || 0);
    const bw = Math.max(0, Number.parseInt(modal.querySelector("#stockHolderBw").value, 10) || 0);
    const key = accessCode();

    if (!name) {
      errorBox.textContent = "Indique un nom ou un repère.";
      return;
    }
    if (!key) {
      errorBox.textContent = "Le code d’accès doit d’abord être validé dans l’application.";
      return;
    }

    saveButton.disabled = true;
    saveButton.textContent = "Enregistrement…";
    errorBox.textContent = "";

    try {
      const payload = await jsonp({
        action: "stockUpsert",
        key,
        name,
        color: String(color),
        bw: String(bw),
        mutationId: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      });
      if (!payload?.ok) throw new Error(payload?.error || "Le stock n’a pas été enregistré.");
      try { localStorage.setItem(HOLDER_NAME_KEY, name); } catch (_) {}
      holders = Array.isArray(payload.holders) ? payload.holders : holders;
      modal.hidden = true;
      await renderStockModule();
    } catch (error) {
      console.warn(error);
      errorBox.textContent = error?.message || "Impossible d’enregistrer le stock.";
    } finally {
      saveButton.disabled = false;
      saveButton.textContent = "Enregistrer.";
    }
  }

  function queueRender() {
    if (renderQueued) return;
    renderQueued = true;
    setTimeout(() => {
      renderQueued = false;
      renderStockModule();
    }, 40);
  }

  function start() {
    ensureEditor();
    fixLabels();
    queueRender();
    setTimeout(refreshHolders, 700);

    const stockStat = document.getElementById("statStock");
    if (stockStat) {
      const observer = new MutationObserver(() => {
        fixLabels();
        if (isStockView()) queueRender();
      });
      observer.observe(stockStat, { childList: true, subtree: true, characterData: true });
    }

    document.addEventListener("click", event => {
      const stockButton = event.target.closest?.("#stockUpdateBtn");
      if (stockButton) {
        openEditor();
        return;
      }

      const button = event.target.closest?.(".circuit-btn");
      if (!button) return;
      setTimeout(() => {
        fixLabels();
        queueRender();
        if (button.dataset.circuit === "STOCK") refreshHolders();
      }, 80);
    });

    window.addEventListener("online", () => { if (isStockView()) refreshHolders(); });
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible" && isStockView()) refreshHolders();
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})();