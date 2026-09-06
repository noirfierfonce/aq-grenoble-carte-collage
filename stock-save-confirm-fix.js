(() => {
  "use strict";

  const API = window.AQ_APP_CONFIG?.apiUrl || "";
  const ACCESS_KEY = "aq-grenoble-access-v2";
  const HOLDER_NAME_KEY = "aq-grenoble-stock-holder-v1";
  const FRAME_ID = "aqStockPostConfirmFix";

  const read = (storage, key) => {
    try { return storage.getItem(key) || ""; } catch (_) { return ""; }
  };

  const accessCode = () => read(localStorage, ACCESS_KEY) || read(sessionStorage, ACCESS_KEY);
  const normalize = value => String(value || "").trim().toLocaleLowerCase("fr");

  function jsonp(params) {
    return new Promise((resolve, reject) => {
      if (!API) return reject(new Error("Synchronisation indisponible."));
      const callback = `__aqstockfix_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const script = document.createElement("script");
      const timer = setTimeout(() => cleanup(new Error("Délai de vérification dépassé.")), 10000);

      function cleanup(error, data) {
        clearTimeout(timer);
        try { delete window[callback]; } catch (_) {}
        script.remove();
        error ? reject(error) : resolve(data);
      }

      window[callback] = data => cleanup(null, data);
      script.onerror = () => cleanup(new Error("Vérification du stock indisponible."));
      const query = new URLSearchParams(params);
      query.set("callback", callback);
      query.set("_", String(Date.now()));
      script.src = `${API}?${query.toString()}`;
      document.head.appendChild(script);
    });
  }

  function submitHiddenForm(params) {
    let frame = document.getElementById(FRAME_ID);
    if (!frame) {
      frame = document.createElement("iframe");
      frame.id = FRAME_ID;
      frame.name = FRAME_ID;
      frame.hidden = true;
      frame.setAttribute("aria-hidden", "true");
      document.body.appendChild(frame);
    }

    const form = document.createElement("form");
    form.method = "POST";
    form.action = API;
    form.target = FRAME_ID;
    form.hidden = true;

    Object.entries(params).forEach(([key, value]) => {
      const input = document.createElement("input");
      input.type = "hidden";
      input.name = key;
      input.value = String(value ?? "");
      form.appendChild(input);
    });

    document.body.appendChild(form);
    form.submit();
    setTimeout(() => form.remove(), 1500);
  }

  async function confirmSaved(name, color, bw, contact, key) {
    for (let attempt = 0; attempt < 8; attempt++) {
      await new Promise(resolve => setTimeout(resolve, attempt === 0 ? 500 : 900));
      const payload = await jsonp({ action: "stockSnapshot", key });
      if (!payload?.ok || !Array.isArray(payload.holders)) continue;
      const saved = payload.holders.find(holder => normalize(holder.name) === normalize(name));
      if (
        saved &&
        Number(saved.color) === color &&
        Number(saved.bw) === bw &&
        String(saved.contact || "") === contact
      ) {
        return true;
      }
    }
    return false;
  }

  document.addEventListener("submit", async event => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement) || form.id !== "stockEditFormV3") return;

    event.preventDefault();
    event.stopImmediatePropagation();

    const modal = document.getElementById("stockEditModalV3");
    const errorBox = document.getElementById("stockEditErrorV3");
    const saveButton = document.getElementById("stockEditSaveV3");
    const name = document.getElementById("stockHolderNameV3")?.value.trim() || "";
    const contact = document.getElementById("stockHolderContactV3")?.value.trim() || "";
    const color = Math.max(0, Number.parseInt(document.getElementById("stockHolderColorV3")?.value || "0", 10) || 0);
    const bw = Math.max(0, Number.parseInt(document.getElementById("stockHolderBwV3")?.value || "0", 10) || 0);
    const key = accessCode();

    if (!name) {
      if (errorBox) errorBox.textContent = "Indique un nom ou un repère.";
      return;
    }
    if (!key) {
      if (errorBox) errorBox.textContent = "Le code d’accès doit d’abord être validé dans l’application.";
      return;
    }

    if (saveButton) {
      saveButton.disabled = true;
      saveButton.textContent = "Enregistrement…";
    }
    if (errorBox) errorBox.textContent = "";

    try {
      submitHiddenForm({
        action: "stockUpsert",
        key,
        name,
        color,
        bw,
        contact,
        mutationId: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      });

      const confirmed = await confirmSaved(name, color, bw, contact, key);
      if (!confirmed) throw new Error("La mise à jour n’a pas pu être confirmée par le serveur.");

      try { localStorage.setItem(HOLDER_NAME_KEY, name); } catch (_) {}
      if (modal) modal.hidden = true;
      location.reload();
    } catch (error) {
      console.warn(error);
      if (errorBox) errorBox.textContent = error?.message || "Impossible d’enregistrer le stock.";
      if (saveButton) {
        saveButton.disabled = false;
        saveButton.textContent = "Enregistrer.";
      }
    }
  }, true);
})();