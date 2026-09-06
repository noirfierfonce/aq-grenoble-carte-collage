(() => {
  "use strict";

  const KEY = "aq-grenoble-access-v2";

  try {
    const saved = localStorage.getItem(KEY);
    if (saved && !sessionStorage.getItem(KEY)) {
      sessionStorage.setItem(KEY, saved);
    }
  } catch (_) {}

  function saveCurrentCode() {
    const input = document.getElementById("accessInput");
    const value = input?.value?.trim();
    if (!value) return;
    try {
      localStorage.setItem(KEY, value);
      sessionStorage.setItem(KEY, value);
    } catch (_) {}
  }

  const form = document.getElementById("accessForm");
  if (form) {
    form.addEventListener("submit", saveCurrentCode, true);
  } else {
    document.addEventListener("DOMContentLoaded", () => {
      document.getElementById("accessForm")?.addEventListener("submit", saveCurrentCode, true);
    }, { once: true });
  }
})();
