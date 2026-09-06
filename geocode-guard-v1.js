(() => {
  "use strict";

  const RESET_FLAG = "aq-geocode-guard-v1-reset";
  const GEO_KEY = "aq-grenoble-geocode-v2";
  const GRENOBLE_BBOX = "5.67,45.14,5.77,45.22";

  /* Les anciens résultats Photon contiennent quelques faux positifs hors Grenoble.
     On purge une seule fois le cache local pour forcer un recalcul propre. */
  try {
    if (localStorage.getItem(RESET_FLAG) !== "1") {
      localStorage.removeItem(GEO_KEY);
      localStorage.setItem(RESET_FLAG, "1");
    }
  } catch (_) {}

  const nativeFetch = window.fetch.bind(window);

  window.fetch = async function(input, init) {
    let url;
    try {
      const raw = typeof input === "string" ? input : input?.url;
      url = new URL(raw, location.href);
    } catch (_) {
      return nativeFetch(input, init);
    }

    if (url.hostname !== "photon.komoot.io" || !url.pathname.startsWith("/api")) {
      return nativeFetch(input, init);
    }

    /* On borne la recherche à Grenoble et on demande plusieurs candidats pour
       pouvoir privilégier explicitement ceux dont Photon indique Grenoble. */
    url.searchParams.set("bbox", GRENOBLE_BBOX);
    url.searchParams.set("limit", "10");

    const response = await nativeFetch(url.toString(), init);
    if (!response.ok) return response;

    try {
      const data = await response.clone().json();
      const features = Array.isArray(data?.features) ? data.features : [];
      if (!features.length) return response;

      const inGrenoble = features.filter(feature => {
        const p = feature?.properties || {};
        const place = [p.city, p.locality, p.district, p.county, p.state]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return place.includes("grenoble");
      });

      if (inGrenoble.length) data.features = inGrenoble;

      const headers = new Headers(response.headers);
      headers.delete("content-length");
      headers.delete("content-encoding");
      headers.set("content-type", "application/json; charset=utf-8");
      return new Response(JSON.stringify(data), {
        status: response.status,
        statusText: response.statusText,
        headers
      });
    } catch (_) {
      return response;
    }
  };
})();
