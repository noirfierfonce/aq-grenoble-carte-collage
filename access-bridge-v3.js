(() => {
  "use strict";

  const KEY = "aq-grenoble-access-v2";
  const COOKIE = "aq_collage_access";
  const COOKIE_PATH = "/aq-grenoble-carte-collage/";
  const MAX_AGE = 60 * 24 * 60 * 60;

  const nativeGet = Storage.prototype.getItem;
  const nativeSet = Storage.prototype.setItem;

  function readCookie() {
    const prefix = `${COOKIE}=`;
    const item = document.cookie.split(";").map(v => v.trim()).find(v => v.startsWith(prefix));
    if (!item) return "";
    try { return decodeURIComponent(item.slice(prefix.length)); } catch (_) { return ""; }
  }

  function writeCookie(value) {
    if (!value) return;
    document.cookie = `${COOKIE}=${encodeURIComponent(value)}; Max-Age=${MAX_AGE}; Path=${COOKIE_PATH}; SameSite=Lax; Secure`;
  }

  function mirror(value) {
    if (!value) return;
    try { nativeSet.call(localStorage, KEY, value); } catch (_) {}
    try { nativeSet.call(sessionStorage, KEY, value); } catch (_) {}
    writeCookie(value);
  }

  // Restaure immédiatement avant le chargement de l’application.
  let saved = "";
  try { saved = nativeGet.call(localStorage, KEY) || ""; } catch (_) {}
  if (!saved) saved = readCookie();
  if (saved) mirror(saved);

  // L’application existante écrit dans sessionStorage : on rend cette écriture durable.
  Storage.prototype.setItem = function patchedSetItem(key, value) {
    nativeSet.call(this, key, value);
    if (this === sessionStorage && key === KEY && value) {
      try { nativeSet.call(localStorage, KEY, value); } catch (_) {}
      writeCookie(value);
    }
  };

  // Et si une session neuve est vide, sessionStorage.getItem récupère le code durable.
  Storage.prototype.getItem = function patchedGetItem(key) {
    const value = nativeGet.call(this, key);
    if (this === sessionStorage && key === KEY && !value) {
      let fallback = "";
      try { fallback = nativeGet.call(localStorage, KEY) || ""; } catch (_) {}
      if (!fallback) fallback = readCookie();
      if (fallback) {
        try { nativeSet.call(sessionStorage, KEY, fallback); } catch (_) {}
        return fallback;
      }
    }
    return value;
  };

  document.getElementById("accessForm")?.addEventListener("submit", () => {
    const value = document.getElementById("accessInput")?.value?.trim() || "";
    if (value) mirror(value);
  }, true);
})();
