(() => {
  "use strict";

  if (!window.L?.Map) return;

  const originalFitBounds = L.Map.prototype.fitBounds;
  const fitState = new WeakMap();
  let allowNextFit = false;

  document.addEventListener("click", event => {
    if (event.target.closest?.(".circuit-btn")) allowNextFit = true;
  }, true);

  L.Map.prototype.fitBounds = function(bounds, options) {
    const state = fitState.get(this) || { fitted: false };

    if (!state.fitted || allowNextFit) {
      state.fitted = true;
      allowNextFit = false;
      fitState.set(this, state);
      return originalFitBounds.call(this, bounds, {
        ...options,
        animate: false
      });
    }

    return this;
  };
})();
