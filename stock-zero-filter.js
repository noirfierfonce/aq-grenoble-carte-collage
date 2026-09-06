(() => {
  "use strict";

  function apply() {
    const root = document.getElementById("physicalStockModuleV3");
    if (!root) return;
    const details = root.querySelector("details.stock-distribution");
    if (!details) return;
    const rows = [...details.querySelectorAll(".stock-holder-row")];
    let visible = 0;
    rows.forEach(row => {
      const text = row.querySelector(".stock-holder-qty")?.textContent || "";
      const nums = text.match(/\d+/g)?.map(Number) || [];
      const hasStock = (nums[0] || 0) > 0 || (nums[1] || 0) > 0;
      row.hidden = !hasStock;
      if (hasStock) visible++;
    });
    const summarySpans = details.querySelectorAll("summary span");
    if (summarySpans[1]) summarySpans[1].textContent = `${visible} emplacement${visible > 1 ? "s" : ""}.`;
    let empty = details.querySelector(".stock-zero-empty");
    if (!visible) {
      if (!empty) {
        empty = document.createElement("div");
        empty.className = "stock-empty stock-zero-empty";
        empty.textContent = "Aucun emplacement ne détient actuellement d’affiches.";
        details.querySelector(".stock-holder-list")?.appendChild(empty);
      }
      empty.hidden = false;
    } else if (empty) {
      empty.hidden = true;
    }
  }

  function start() {
    apply();
    const observer = new MutationObserver(apply);
    observer.observe(document.getElementById("pointList") || document.body, { childList: true, subtree: true });
    document.addEventListener("click", event => {
      if (event.target.closest?.(".circuit-btn")) setTimeout(apply, 250);
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})();