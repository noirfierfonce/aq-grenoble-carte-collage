(() => {
  "use strict";

  const API = window.AQ_APP_CONFIG?.apiUrl || "";
  const ACCESS_KEY = "aq-grenoble-access-v2";
  const HOLDER_NAME_KEY = "aq-grenoble-stock-holder-v1";
  const FRAME_NAME = "aqStockSaveFixFrame";

  const read = (storage, key) => {
    try { return storage.getItem(key) || ""; } catch (_) { return ""; }
  };

  const accessCode = () => read(localStorage, ACCESS_KEY) || read(sessionStorage, ACCESS_KEY);
  const normalize = value => String(value || "").trim().toLocaleLowerCase("fr");
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

  function jsonp(params) {
    return new Promise((resolve, reject) => {
      if (!API) return reject(new Error("Synchronisation indisponible."));
      const callback = `__aqstocksave_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const script = document.createElement("script");
      const timer = setTimeout(() => cleanup(new Error("Délai de confirmation dépassé.")), 10000);

      function cleanup(error, data) {
        clearTimeout(timer);
        try { delete window[callback]; } catch (_) {}
        script.remove();
        error ? reject(error) : resolve(data);
      }

      window[callback] = data => cleanup(null, data);
      script.onerror = () => cleanup(new Error("Confirmation du stock indisponible."));
      const query = new URLSearchParams(params);
      query.set("callback", callback);
      query.set("_", String(Date.now()));
      script.src = `${API}?${query.toString()}`;
      document.head.appendChild(script);
    });
  }

  function submitPost(params) {
    let frame = document.getElementById(FRAME_NAME);
    if (!frame) {
      frame = document.createElement("iframe");
      frame.id = FRAME_NAME;
      frame.name = FRAME_NAME;
      frame.hidden = true;
      frame.setAttribute("aria-hidden", "true");
      document.body.appendChild(frame);
    }

    const form = document.createElement("form");
    form.method = "POST";
    form.action = API;
    form.target = FRAME_NAME;
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

  async function confirmSaved(expected) {
    for (let attempt = 0; attempt < 10; attempt++) {
      if (attempt) await sleep(700);
      try {
        const payload = await jsonp({ action: "stockSnapshot", key: expected.key });
        const rows = Array.isArray(payload?.holders) ? payload.holders : [];
        const saved = rows.find(holder => normalize(holder.name) === normalize(expected.name));
        if (
          saved &&
          Number(saved.color) === expected.color &&
          Number(saved.bw) === expected.bw &&
          String(saved.contact || "") === expected.contact
        ) return true;
      } catch (_) {}
    }
    return false;
  }

  async function handleSubmit(event) {
    const form = event.target;
    if (!(form instanceof HTMLFormElement) || form.id !== "stockEditFormV3") return;

    event.preventDefault();
    event.stopImmediatePropagation();

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
      submitPost({
        action: "stockUpsert",
        key,
        name,
        color,
        bw,
        contact,
        mutationId: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      });

      const confirmed = await confirmSaved({ key, name, color, bw, contact });
      if (!confirmed) throw new Error("Le serveur n’a pas confirmé la mise à jour du stock.");

      try { localStorage.setItem(HOLDER_NAME_KEY, name); } catch (_) {}
      const modal = document.getElementById("stockEditModalV3");
      if (modal) modal.hidden = true;
      location.reload();
    } catch (error) {
      if (errorBox) errorBox.textContent = error?.message || "Impossible d’enregistrer le stock.";
      if (saveButton) {
        saveButton.disabled = false;
        saveButton.textContent = "Enregistrer.";
      }
    }
  }

  document.addEventListener("submit", handleSubmit, true);
})();
