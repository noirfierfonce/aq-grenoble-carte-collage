(() => {
  "use strict";

  function isStockView() {
    return (new URL(location.href).searchParams.get("c") || "").toUpperCase() === "STOCK";
  }

  function apply() {
    if (!isStockView()) return;

    const badge = document.getElementById("circuitBadge");
    const title = document.getElementById("zoneTitle");

    if (badge && badge.textContent !== "📦 Stock.") badge.textContent = "📦 Stock.";
    if (title && title.textContent !== "Disponible et nécessaire.") title.textContent = "Disponible et nécessaire.";
  }

  function start() {
    apply();

    const observer = new MutationObserver(apply);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });

    document.addEventListener("click", event => {
      if (!event.target.closest?.(".circuit-btn")) return;
      setTimeout(apply, 100);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
