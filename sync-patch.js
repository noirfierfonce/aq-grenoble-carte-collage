(() => {
  "use strict";

  const nativeFetch = window.fetch.bind(window);
  const inFlight = new Map();
  const RETRIES = 3;

  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

  function jsonpOnce(url, params, timeout = 12000) {
    return new Promise((resolve, reject) => {
      const callback = `__aqmut_${Date.now()}_${Math.random().toString(36).slice(2)}`;
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
      query.set("action", "mutate");
      query.set("callback", callback);
      query.set("_", String(Date.now()));
      script.src = `${url}?${query.toString()}`;
      document.head.appendChild(script);
    });
  }

  async function jsonpWithRetry(url, params) {
    let lastError = null;
    for (let attempt = 1; attempt <= RETRIES; attempt++) {
      try {
        const payload = await jsonpOnce(url, params, attempt === 1 ? 12000 : 16000);
        if (!payload?.ok) throw new Error(payload?.error || "La modification n’a pas été enregistrée.");
        return payload;
      } catch (error) {
        lastError = error;
        if (attempt < RETRIES) await sleep(700 * attempt);
      }
    }
    throw lastError || new Error("Synchronisation impossible.");
  }

  function mutationKey(body) {
    return body.get("mutationId") || [body.get("circuit"), body.get("name"), body.get("status"), body.get("capacity")].join("|");
  }

  window.fetch = async function patchedFetch(input, init = {}) {
    const apiUrl = window.AQ_APP_CONFIG?.apiUrl || "";
    const url = typeof input === "string" ? input : (input?.url || "");
    const method = String(init?.method || input?.method || "GET").toUpperCase();

    if (!apiUrl || method !== "POST" || url !== apiUrl) {
      return nativeFetch(input, init);
    }

    const body = init?.body instanceof URLSearchParams
      ? new URLSearchParams(init.body.toString())
      : new URLSearchParams(String(init?.body || ""));

    const action = String(body.get("action") || "").trim();

    // Les mutations de points passent par JSONP. Les autres POST, notamment le stock,
    // restent de vrais POST afin de ne pas exposer les coordonnées dans l’URL.
    if (action && action !== "mutate") {
      return nativeFetch(input, init);
    }

    // Plusieurs flushQueue peuvent se lancer pendant une saisie rapide. On partage la
    // même promesse pour un mutationId donné afin d’éviter d’envoyer plusieurs fois
    // exactement la même écriture au serveur.
    const key = mutationKey(body);
    let pending = inFlight.get(key);
    if (!pending) {
      pending = jsonpWithRetry(apiUrl, body).finally(() => inFlight.delete(key));
      inFlight.set(key, pending);
    }

    const payload = await pending;
    return {
      ok: true,
      status: 200,
      json: async () => payload,
      text: async () => JSON.stringify(payload)
    };
  };
})();
