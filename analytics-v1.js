(() => {
  "use strict";

  const config = window.AQ_APP_CONFIG || {};
  if (!config.apiUrl) return;

  const VISITOR_KEY = "aq38-analytics-visitor-v1";
  const SESSION_KEY = "aq38-analytics-session-v1";

  const visitorId = getOrCreateId(localStorage, VISITOR_KEY, "v");
  const sessionId = getOrCreateId(sessionStorage, SESSION_KEY, "s");

  function randomId(prefix) {
    if (window.crypto?.randomUUID) {
      return `${prefix}_${window.crypto.randomUUID().replace(/-/g, "")}`;
    }
    const bytes = new Uint8Array(16);
    if (window.crypto?.getRandomValues) window.crypto.getRandomValues(bytes);
    else for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
    return `${prefix}_${Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("")}`;
  }

  function getOrCreateId(storage, key, prefix) {
    try {
      const existing = storage.getItem(key);
      if (existing) return existing;
      const value = randomId(prefix);
      storage.setItem(key, value);
      return value;
    } catch {
      return randomId(prefix);
    }
  }

  function currentView() {
    return (new URLSearchParams(location.search).get("c") || "ALL").toUpperCase();
  }

  function displayMode() {
    if (window.matchMedia?.("(display-mode: standalone)").matches || navigator.standalone === true) return "pwa";
    return "browser";
  }

  function send(event, details = {}) {
    const body = new URLSearchParams({
      action: "analytics",
      event,
      visitorId,
      sessionId,
      view: details.view || currentView(),
      target: details.target || "",
      mode: displayMode(),
      path: `${location.pathname}${location.search}`
    });

    try {
      fetch(config.apiUrl, {
        method: "POST",
        mode: "no-cors",
        keepalive: true,
        body
      }).catch(() => {});
    } catch {}
  }

  function trackOpen() {
    send("open");
  }

  document.addEventListener("DOMContentLoaded", trackOpen, { once: true });

  document.addEventListener("click", event => {
    const circuitButton = event.target.closest?.(".circuit-btn[data-circuit]");
    if (circuitButton) {
      send("view", { view: String(circuitButton.dataset.circuit || "ALL").toUpperCase() });
      return;
    }

    const route = event.target.closest?.('a[href*="google.com/maps/dir"]');
    if (route) {
      send("route", { target: route.closest("[data-point]")?.dataset?.point || "itineraire" });
      return;
    }

    const share = event.target.closest?.("#shareBtn");
    if (share) {
      send("share");
      return;
    }

    const link = event.target.closest?.("a[href]");
    if (link && /drive\.google\.com/i.test(link.href) && /affiche/i.test(`${link.textContent} ${link.getAttribute("aria-label") || ""} ${link.title || ""}`)) {
      send("affiches", { target: "dossier_affiches" });
    }
  }, true);
})();
