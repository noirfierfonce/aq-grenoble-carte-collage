(() => {
  "use strict";

  const nativeFetch = window.fetch.bind(window);

  function jsonp(url, params) {
    return new Promise((resolve, reject) => {
      const callback = `__aqmut_${Date.now()}_${Math.random().toString(36).slice(2)}`;
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
      query.set("action", "mutate");
      query.set("callback", callback);
      query.set("_", String(Date.now()));
      script.src = `${url}?${query.toString()}`;
      document.head.appendChild(script);
    });
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

    // Le correctif JSONP historique ne concerne que les mutations de points.
    // Les autres POST (notamment le stock avec contact facultatif) restent de vrais POST,
    // afin de ne pas transformer les coordonnées en paramètres d’URL.
    if (action && action !== "mutate") {
      return nativeFetch(input, init);
    }

    const payload = await jsonp(apiUrl, body);
    if (!payload?.ok) {
      throw new Error(payload?.error || "La modification n’a pas été enregistrée.");
    }

    return {
      ok: true,
      status: 200,
      json: async () => payload,
      text: async () => JSON.stringify(payload)
    };
  };
})();
