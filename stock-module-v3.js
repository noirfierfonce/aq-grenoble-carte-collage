(() => {
  "use strict";

  const API = window.AQ_APP_CONFIG?.apiUrl || "";
  const ACCESS_KEY = "aq-grenoble-access-v2";
  const TRACKING_KEY = "aq-grenoble-shared-cache-v2";
  const HOLDER_NAME_KEY = "aq-grenoble-stock-holder-v1";
  const POST_FRAME = "aqStockPostFrameV3";

  let pointsPromise = null;
  let holders = [];
  let refreshing = false;
  let renderTimer = null;

  const read = (storage, key) => {
    try { return storage.getItem(key) || ""; } catch (_) { return ""; }
  };

  const accessCode = () => read(localStorage, ACCESS_KEY) || read(sessionStorage, ACCESS_KEY);
  const isStockView = () => (new URL(location.href).searchParams.get("c") || "").toUpperCase() === "STOCK";

  function loadTracking() {
    try { return JSON.parse(localStorage.getItem(TRACKING_KEY) || "{}"); }
    catch (_) { return {}; }
  }

  function loadPoints() {
    if (!pointsPromise) {
      pointsPromise = fetch("./data/points.json", { cache: "no-store" }).then(response => {
        if (!response.ok) throw new Error("Points indisponibles.");
        return response.json();
      });
    }
    return pointsPromise;
  }

  function trackingFor(point, tracking) {
    return { status: "todo", capacity: null, ...(tracking[`${point.circuit}|${point.name}`] || {}) };
  }

  function neededStock(points, tracking) {
    let color = 0;
    let bw = 0;
    for (const point of points) {
      const current = trackingFor(point, tracking);
      if (!["todo", "repost"].includes(current.status)) continue;
      const qty = Number(current.capacity) || 1;
      if (String(point.poster || "").includes("Couleur")) color += qty;
      else bw += qty;
    }
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
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function normalize(value) {
    return String(value || "").trim().toLocaleLowerCase("fr");
  }

  function formatUpdated(value) {
    if (!value) return "Mise à jour non datée.";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Mise à jour non datée.";
    return `Mis à jour le ${new Intl.DateTimeFormat("fr-FR", {
      day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit"
    }).format(date)}.`;
  }

  function jsonp(params) {
    return new Promise((resolve, reject) => {
      if (!API) return reject(new Error("Synchronisation indisponible."));
      const callback = `__aqstockv3_${Date.now()}_${Math.random().toString(36).slice(2)}`;
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

  function ensurePostFrame() {
    let frame = document.getElementById(POST_FRAME);
    if (frame) return frame;
    frame = document.createElement("iframe");
    frame.id = POST_FRAME;
    frame.name = POST_FRAME;
    frame.hidden = true;
    frame.setAttribute("aria-hidden", "true");
    document.body.appendChild(frame);
    return frame;
  }

  function postForm(params) {
    return new Promise((resolve, reject) => {
      if (!API) return reject(new Error("Synchronisation indisponible."));
      const frame = ensurePostFrame();
      const form = document.createElement("form");
      form.method = "POST";
      form.action = API;
      form.target = POST_FRAME;
      form.hidden = true;

      Object.entries(params).forEach(([key, value]) => {
        const input = document.createElement("input");
        input.type = "hidden";
        input.name = key;
        input.value = String(value ?? "");
        form.appendChild(input);
      });

      let settled = false;
      const timer = setTimeout(() => finish(new Error("Délai d’enregistrement dépassé.")), 12000);
      const onLoad = () => {
        if (!settled) setTimeout(() => finish(null), 250);
      };

      function finish(error) {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        frame.removeEventListener("load", onLoad);
        form.remove();
        error ? reject(error) : resolve();
      }

      frame.addEventListener("load", onLoad);
      document.body.appendChild(form);
      form.submit();
    });
  }

  async function fetchHolders() {
    const key = accessCode();
    if (!key) throw new Error("Le code d’accès doit d’abord être validé dans l’application.");
    const payload = await jsonp({ action: "stockSnapshot", key });
    if (!payload?.ok || !Array.isArray(payload.holders)) {
      throw new Error(payload?.error || "Le stock partagé est indisponible.");
    }
    holders = payload.holders;
    return holders;
  }

  async function refreshHolders() {
    if (refreshing || !API || !accessCode()) return;
    refreshing = true;
    try {
      await fetchHolders();
    } catch (error) {
      console.warn("Stock physique", error);
    } finally {
      refreshing = false;
      scheduleRender(0);
    }
  }

  function balanceLine(label, available, needed) {
    const difference = available - needed;
    if (difference >= 0) return `<span class="ok">${escapeHtml(label)} : ${difference} en marge après le besoin actuel.</span>`;
    const n = Math.abs(difference);
    return `<span class="missing">${escapeHtml(label)} : il manque ${n} affiche${n > 1 ? "s" : ""}.</span>`;
  }

  function ensureEditor() {
    let modal = document.getElementById("stockEditModalV3");
    if (modal) return modal;

    modal = document.createElement("div");
    modal.id = "stockEditModalV3";
    modal.className = "stock-edit-modal";
    modal.hidden = true;
    modal.innerHTML = `
      <form class="stock-edit-card" id="stockEditFormV3">
        <h2>Mettre à jour mon stock.</h2>
        <p>Indique ce que tu as physiquement chez toi ou dans ton point de stockage.</p>
        <label>Nom ou repère.
          <input id="stockHolderNameV3" maxlength="60" autocomplete="name" required placeholder="Ex. Nox, local, équipe B.">
        </label>
        <label>Moyen de contact. <span style="font-weight:400;color:#8f949d">Facultatif.</span>
          <input id="stockHolderContactV3" maxlength="120" autocomplete="off" placeholder="Ex. Signal @pseudo, 06…, mail…">
          <small style="display:block;color:#8f949d;font-size:.76rem;font-weight:400;line-height:1.35">Visible uniquement par les personnes ayant le code d’accès.</small>
        </label>
        <div class="stock-edit-grid">
          <label>Affiches couleur.
            <input id="stockHolderColorV3" type="number" min="0" step="1" inputmode="numeric" value="0" required>
          </label>
          <label>Affiches N&B.
            <input id="stockHolderBwV3" type="number" min="0" step="1" inputmode="numeric" value="0" required>
          </label>
        </div>
        <div class="stock-edit-error" id="stockEditErrorV3"></div>
        <div class="stock-edit-actions">
          <button type="button" id="stockEditCancelV3">Annuler.</button>
          <button type="submit" class="primary" id="stockEditSaveV3">Enregistrer.</button>
        </div>
      </form>`;

    document.body.appendChild(modal);
    modal.querySelector("#stockEditCancelV3").addEventListener("click", () => { modal.hidden = true; });
    modal.addEventListener("click", event => { if (event.target === modal) modal.hidden = true; });
    modal.querySelector("#stockEditFormV3").addEventListener("submit", saveHolder);
    return modal;
  }

  function openEditor() {
    const modal = ensureEditor();
    const savedName = read(localStorage, HOLDER_NAME_KEY);
    const existing = holders.find(holder => normalize(holder.name) === normalize(savedName));
    modal.querySelector("#stockHolderNameV3").value = savedName || "";
    modal.querySelector("#stockHolderContactV3").value = existing?.contact || "";
    modal.querySelector("#stockHolderColorV3").value = String(existing?.color ?? 0);
    modal.querySelector("#stockHolderBwV3").value = String(existing?.bw ?? 0);
    modal.querySelector("#stockEditErrorV3").textContent = "";
    modal.hidden = false;
    setTimeout(() => modal.querySelector("#stockHolderNameV3")?.focus(), 30);
  }

  async function saveHolder(event) {
    event.preventDefault();
    const modal = ensureEditor();
    const errorBox = modal.querySelector("#stockEditErrorV3");
    const saveButton = modal.querySelector("#stockEditSaveV3");
    const name = modal.querySelector("#stockHolderNameV3").value.trim();
    const contact = modal.querySelector("#stockHolderContactV3").value.trim();
    const color = Math.max(0, Number.parseInt(modal.querySelector("#stockHolderColorV3").value, 10) || 0);
    const bw = Math.max(0, Number.parseInt(modal.querySelector("#stockHolderBwV3").value, 10) || 0);
    const key = accessCode();

    if (!name) return void (errorBox.textContent = "Indique un nom ou un repère.");
    if (!key) return void (errorBox.textContent = "Le code d’accès doit d’abord être validé dans l’application.");

    saveButton.disabled = true;
    saveButton.textContent = "Enregistrement…";
    errorBox.textContent = "";

    try {
      await postForm({
        action: "stockUpsert",
        key,
        name,
        color,
        bw,
        contact,
        mutationId: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      });

      let confirmed = false;
      for (let attempt = 0; attempt < 5; attempt++) {
        await new Promise(resolve => setTimeout(resolve, attempt === 0 ? 600 : 900));
        await fetchHolders();
        const saved = holders.find(holder => normalize(holder.name) === normalize(name));
        if (saved && Number(saved.color) === color && Number(saved.bw) === bw && String(saved.contact || "") === contact) {
          confirmed = true;
          break;
        }
      }

      if (!confirmed) throw new Error("La mise à jour n’a pas pu être confirmée par le serveur.");
      try { localStorage.setItem(HOLDER_NAME_KEY, name); } catch (_) {}
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

  async function renderStockModule() {
    if (!isStockView()) {
      document.getElementById("physicalStockModuleV3")?.remove();
      return;
    }

    const list = document.getElementById("pointList");
    if (!list) return;

    let root = document.getElementById("physicalStockModuleV3");
    if (!root) {
      root = document.createElement("li");
      root.id = "physicalStockModuleV3";
      root.className = "point-card stock-live-card";
      list.prepend(root);
    } else if (list.firstElementChild !== root) {
      list.prepend(root);
    }

    root.innerHTML = '<div class="stock-empty">Chargement du stock partagé…</div>';

    try {
      const points = await loadPoints();
      const needed = neededStock(points, loadTracking());
      const available = availableStock();
      const totalAvailable = available.color + available.bw;

      document.getElementById("subtitle").textContent = "Disponible · nécessaire · répartition.";
      document.getElementById("circuitBadge").textContent = "📦 Stock.";
      document.getElementById("zoneTitle").textContent = "Disponible et nécessaire.";
      document.getElementById("count").textContent = `${needed.total} nécessaires.`;
      const progress = document.getElementById("progress");
      if (progress) progress.style.display = "none";
      const hint = document.querySelector(".hint");
      if (hint) hint.textContent = "Disponible = stock physique déclaré. Nécessaire = besoin calculé automatiquement à partir des circuits.";

      const rows = holders.length ? holders.map(holder => {
        const contact = holder.contact ? `<span class="stock-holder-contact" style="grid-column:1/-1;color:#c7cbd2;font-size:.82rem;overflow-wrap:anywhere">Contact : ${escapeHtml(holder.contact)}</span>` : "";
        return `<div class="stock-holder-row">
          <span class="stock-holder-name">${escapeHtml(holder.name)}</span>
          <span class="stock-holder-qty">🎨 ${Math.max(0, Number(holder.color) || 0)} · ⚫ ${Math.max(0, Number(holder.bw) || 0)}</span>
          <span class="stock-holder-time">${escapeHtml(formatUpdated(holder.updated))}</span>
          ${contact}
        </div>`;
      }).join("") : '<div class="stock-empty">Aucun stock physique n’est encore renseigné.</div>';

      root.innerHTML = `
        <div class="stock-live-head"><div>
          <h3 class="stock-live-title">📦 Stock des affiches.</h3>
          <p class="stock-live-sub">Une vue commune, même quand les affiches sont dispersées chez plusieurs personnes.</p>
        </div></div>
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
        <button type="button" class="primary stock-update-btn" id="stockUpdateBtnV3">Mettre à jour mon stock.</button>
        <details class="stock-distribution">
          <summary><span>Répartition du stock.</span><span>${holders.length} emplacement${holders.length > 1 ? "s" : ""}.</span></summary>
          <div class="stock-holder-list">${rows}</div>
        </details>
        <p class="stock-module-note">Chaque personne peut mettre à jour ce qu’elle a réellement chez elle. Le total disponible se recalcule automatiquement.</p>`;

      root.querySelector("#stockUpdateBtnV3")?.addEventListener("click", openEditor);
    } catch (error) {
      console.warn(error);
      root.innerHTML = `<div class="stock-empty">Erreur du module stock : ${escapeHtml(error?.message || "chargement impossible")}.</div>`;
    }
  }

  function scheduleRender(delay = 80) {
    clearTimeout(renderTimer);
    renderTimer = setTimeout(() => renderStockModule(), delay);
  }

  function start() {
    ensureEditor();
    ensurePostFrame();
    scheduleRender(150);
    setTimeout(refreshHolders, 500);

    document.addEventListener("click", event => {
      const button = event.target.closest?.(".circuit-btn");
      if (!button) return;
      setTimeout(() => {
        scheduleRender(0);
        if (button.dataset.circuit === "STOCK") refreshHolders();
      }, 120);
    });

    const list = document.getElementById("pointList");
    if (list) {
      const observer = new MutationObserver(() => {
        if (isStockView() && !document.getElementById("physicalStockModuleV3")) scheduleRender(0);
      });
      observer.observe(list, { childList: true });
    }

    window.addEventListener("online", () => { if (isStockView()) refreshHolders(); });
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible" && isStockView()) refreshHolders();
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})();