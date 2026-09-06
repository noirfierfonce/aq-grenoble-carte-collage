(() => {
  "use strict";

  const API = window.AQ_APP_CONFIG?.apiUrl || "";
  const ACCESS_KEY = "aq-grenoble-access-v2";
  const HOLDER_NAME_KEY = "aq-grenoble-stock-holder-v1";
  let holders = [];
  let loading = false;

  function read(storage, key) {
    try { return storage.getItem(key) || ""; } catch (_) { return ""; }
  }

  function accessCode() {
    return read(localStorage, ACCESS_KEY) || read(sessionStorage, ACCESS_KEY);
  }

  function normalize(value) {
    return String(value || "").trim().toLocaleLowerCase("fr");
  }

  function jsonp(params) {
    return new Promise((resolve, reject) => {
      if (!API) return reject(new Error("Synchronisation indisponible."));
      const callback = `__aqcontact_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const script = document.createElement("script");
      const timer = setTimeout(() => cleanup(new Error("Délai de synchronisation dépassé.")), 10000);

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

  function ensureStyles() {
    if (document.getElementById("stockContactSecureStyles")) return;
    const style = document.createElement("style");
    style.id = "stockContactSecureStyles";
    style.textContent = `
      .stock-contact-label .optional{font-weight:400;color:#8f949d;margin-left:4px;}
      .stock-contact-help{display:block;color:#8f949d;font-size:.76rem;font-weight:400;line-height:1.35;}
      .stock-holder-contact{grid-column:1 / -1;color:#c7cbd2;font-size:.82rem;overflow-wrap:anywhere;}
    `;
    document.head.appendChild(style);
  }

  function ensureContactField() {
    const nameInput = document.getElementById("stockHolderName");
    if (!nameInput || document.getElementById("stockHolderContact")) return;
    const label = document.createElement("label");
    label.className = "stock-contact-label";
    label.innerHTML = `Moyen de contact.<span class="optional">Facultatif.</span>
      <input id="stockHolderContact" maxlength="120" autocomplete="off" placeholder="Ex. Signal @pseudo, 06…, mail…">
      <small class="stock-contact-help">Visible uniquement par les personnes ayant le code d’accès.</small>`;
    nameInput.closest("label")?.insertAdjacentElement("afterend", label);
  }

  function holderByName(name) {
    return holders.find(holder => normalize(holder.name) === normalize(name));
  }

  function prefillContact() {
    ensureContactField();
    const input = document.getElementById("stockHolderContact");
    if (!input) return;
    const name = document.getElementById("stockHolderName")?.value || read(localStorage, HOLDER_NAME_KEY);
    input.value = holderByName(name)?.contact || "";
  }

  function enhanceRows() {
    document.querySelectorAll(".stock-holder-row").forEach(row => {
      const name = row.querySelector(".stock-holder-name")?.textContent || "";
      const holder = holderByName(name);
      let contact = row.querySelector(".stock-holder-contact");
      if (!holder?.contact) {
        contact?.remove();
        return;
      }
      if (!contact) {
        contact = document.createElement("span");
        contact.className = "stock-holder-contact";
        row.appendChild(contact);
      }
      contact.textContent = `Contact : ${holder.contact}`;
    });
  }

  async function refreshContacts() {
    if (loading || !API || !accessCode()) return;
    loading = true;
    try {
      const payload = await jsonp({ action: "stockSnapshot", key: accessCode() });
      if (payload?.ok && Array.isArray(payload.holders)) {
        holders = payload.holders;
        enhanceRows();
        prefillContact();
      }
    } catch (error) {
      console.warn("Contacts stock", error);
    } finally {
      loading = false;
    }
  }

  async function handleSubmit(event) {
    const form = event.target;
    if (!(form instanceof HTMLFormElement) || form.id !== "stockEditForm") return;

    event.preventDefault();
    event.stopImmediatePropagation();

    const errorBox = document.getElementById("stockEditError");
    const saveButton = document.getElementById("stockEditSave");
    const name = document.getElementById("stockHolderName")?.value.trim() || "";
    const color = Math.max(0, Number.parseInt(document.getElementById("stockHolderColor")?.value || "0", 10) || 0);
    const bw = Math.max(0, Number.parseInt(document.getElementById("stockHolderBw")?.value || "0", 10) || 0);
    const contact = document.getElementById("stockHolderContact")?.value.trim() || "";
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
      const body = new URLSearchParams({
        action: "stockUpsert",
        key,
        name,
        color: String(color),
        bw: String(bw),
        contact,
        mutationId: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      });

      await fetch(API, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
        body
      });

      await new Promise(resolve => setTimeout(resolve, 900));
      const payload = await jsonp({ action: "stockSnapshot", key });
      if (!payload?.ok || !Array.isArray(payload.holders)) throw new Error(payload?.error || "Le stock n’a pas été enregistré.");
      holders = payload.holders;
      const saved = holderByName(name);
      if (!saved || Number(saved.color) !== color || Number(saved.bw) !== bw || String(saved.contact || "") !== contact) {
        throw new Error("La mise à jour n’a pas pu être confirmée.");
      }

      try { localStorage.setItem(HOLDER_NAME_KEY, name); } catch (_) {}
      document.getElementById("stockEditModal").hidden = true;
      location.reload();
    } catch (error) {
      console.warn(error);
      if (errorBox) errorBox.textContent = error?.message || "Impossible d’enregistrer le stock.";
      if (saveButton) {
        saveButton.disabled = false;
        saveButton.textContent = "Enregistrer.";
      }
    }
  }

  function start() {
    ensureStyles();
    ensureContactField();
    setTimeout(refreshContacts, 600);

    document.addEventListener("submit", handleSubmit, true);
    document.addEventListener("click", event => {
      if (event.target.closest?.("#stockUpdateBtn")) setTimeout(() => { ensureContactField(); prefillContact(); }, 40);
      if (event.target.closest?.(".circuit-btn")) setTimeout(refreshContacts, 500);
    });

    const observer = new MutationObserver(() => {
      ensureContactField();
      enhanceRows();
    });
    observer.observe(document.body, { childList: true, subtree: true });

    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") refreshContacts();
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})();
