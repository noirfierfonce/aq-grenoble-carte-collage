(() => {
  "use strict";

  const RESET_FLAG = "aq-geocode-guard-v2-reset";
  const GEO_KEY = "aq-grenoble-geocode-v2";
  const GRENOBLE_CITYCODE = "38185";
  const GRENOBLE_BBOX = "5.67,45.14,5.77,45.22";
  const IGN_SEARCH = "https://data.geopf.fr/geocodage/search";

  /* Les anciens résultats de géocodage ont placé quelques adresses de Grenoble
     dans des communes voisines. On purge une seule fois le cache local afin de
     recalculer tous les repères avec un filtre communal strict. */
  try {
    if (localStorage.getItem(RESET_FLAG) !== "1") {
      localStorage.removeItem(GEO_KEY);
      localStorage.setItem(RESET_FLAG, "1");
    }
  } catch (_) {}

  const nativeFetch = window.fetch.bind(window);

  function jsonResponse(data, response) {
    const headers = new Headers(response?.headers || {});
    headers.delete("content-length");
    headers.delete("content-encoding");
    headers.set("content-type", "application/json; charset=utf-8");
    return new Response(JSON.stringify(data), {
      status: response?.status || 200,
      statusText: response?.statusText || "OK",
      headers
    });
  }

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

    const query = String(url.searchParams.get("q") || "").trim();
    if (!query) return jsonResponse({ type: "FeatureCollection", features: [] });

    /* Source principale : référentiel national d'adresses, limité au code INSEE
       de Grenoble. Un résultat d'une commune voisine ne peut donc plus être choisi. */
    try {
      const ign = new URL(IGN_SEARCH);
      ign.searchParams.set("q", query);
      ign.searchParams.set("limit", "10");
      ign.searchParams.set("autocomplete", "false");
      ign.searchParams.set("citycode", GRENOBLE_CITYCODE);
      ign.searchParams.set("lat", "45.1885");
      ign.searchParams.set("lon", "5.7245");

      const response = await nativeFetch(ign.toString(), init);
      if (response.ok) {
        const data = await response.clone().json();
        const features = Array.isArray(data?.features) ? data.features : [];
        const strict = features.filter(feature => {
          const p = feature?.properties || {};
          return String(p.citycode || p.cityCode || "") === GRENOBLE_CITYCODE;
        });
        if (strict.length) {
          data.features = strict;
          return jsonResponse(data, response);
        }
      }
    } catch (_) {}

    /* Repli Photon uniquement s'il ne trouve rien, toujours borné à Grenoble.
       On n'accepte alors que des résultats explicitement identifiés Grenoble. */
    try {
      url.searchParams.set("bbox", GRENOBLE_BBOX);
      url.searchParams.set("limit", "10");
      const response = await nativeFetch(url.toString(), init);
      if (!response.ok) return response;
      const data = await response.clone().json();
      const features = Array.isArray(data?.features) ? data.features : [];
      data.features = features.filter(feature => {
        const p = feature?.properties || {};
        const place = [p.city, p.locality, p.district, p.county]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return place.includes("grenoble");
      });
      return jsonResponse(data, response);
    } catch (_) {
      return jsonResponse({ type: "FeatureCollection", features: [] });
    }
  };
})();
