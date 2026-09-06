(() => {
  "use strict";

  const LETTERS = new Set("ABCDEFGHIJKLM".split(""));

  function activeCircuit() {
    const active = document.querySelector('.circuit-btn[aria-current="true"]')?.dataset?.circuit;
    if (active) return active;
    return (new URL(location.href).searchParams.get("c") || "ALL").toUpperCase();
  }

  function applyActiveCircuit() {
    document.documentElement.dataset.activeCircuit = activeCircuit();
  }

  function paintMarkers() {
    const current = activeCircuit();
    document.querySelectorAll(".point-dot").forEach(dot => {
      let letter = "";
      const text = String(dot.textContent || "").trim().toUpperCase();
      if (LETTERS.has(text)) letter = text;
      else if (LETTERS.has(current)) letter = current;
      if (letter) dot.dataset.circuit = letter;
      else delete dot.dataset.circuit;
    });
  }

  function refresh() {
    applyActiveCircuit();
    paintMarkers();
  }

  function start() {
    refresh();
    document.addEventListener("click", event => {
      const btn = event.target instanceof Element ? event.target.closest(".circuit-btn") : null;
      if (!btn) return;
      setTimeout(refresh, 0);
      setTimeout(refresh, 250);
    }, true);

    const observer = new MutationObserver(() => refresh());
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["aria-current", "class"] });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})();
