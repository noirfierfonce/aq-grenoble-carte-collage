(() => {
  "use strict";

  const replacements = new Map([
    ["Capacité constatée.", "Quantité estimée."],
    ["Affiches A3 possibles.", "Affiches prévues sur ce point."],
    ["🧭 Capacités relevées", "🧮 Quantités estimées"],
    ["panneaux mesurés.", "points estimés."],
    ["Pour chaque point : ouvre l’itinéraire, choisis l’état, puis indique la capacité constatée au premier passage.", "Pour chaque point : ouvre l’itinéraire, choisis l’état, puis indique la quantité estimée pour ce point."],
    ["Le stock se recalcule automatiquement à partir des états et des capacités relevées sur le terrain.", "Le stock se recalcule automatiquement à partir des états et des quantités estimées." ]
  ]);

  function patchText(root = document.body) {
    if (!root) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      const current = node.nodeValue;
      if (!current) continue;
      let next = current;
      for (const [from, to] of replacements) {
        if (next.includes(from)) next = next.replaceAll(from, to);
      }
      if (next !== current) node.nodeValue = next;
    }
  }

  function start() {
    patchText();
    const observer = new MutationObserver(mutations => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType === Node.TEXT_NODE) patchText(node.parentNode);
          else if (node.nodeType === Node.ELEMENT_NODE) patchText(node);
        }
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})();
