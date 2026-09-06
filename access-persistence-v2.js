(() => {
  "use strict";

  const KEY = "aq-grenoble-access-v2";

  function read(storage) {
    try { return storage.getItem(KEY) || ""; } catch (_) { return ""; }
  }

  function write(storage, value) {
    if (!value) return;
    try { storage.setItem(KEY, value); } catch (_) {}
  }

  function persistKnownCode() {
    const inputValue = document.getElementById("accessInput")?.value?.trim() || "";
    const sessionValue = read(sessionStorage);
    const localValue = read(localStorage);
    const value = inputValue || sessionValue || localValue;
    if (!value) return;
    write(localStorage, value);
    write(sessionStorage, value);
  }

  // Au démarrage, restaure le code permanent vers la session.
  // Si une ancienne session contient déjà le code, la rend permanente.
  const sessionValue = read(sessionStorage);
  const localValue = read(localStorage);
  if (localValue && !sessionValue) write(sessionStorage, localValue);
  if (sessionValue && !localValue) write(localStorage, sessionValue);

  function bindForm() {
    const form = document.getElementById("accessForm");
    if (!form || form.dataset.persistenceBound === "1") return;
    form.dataset.persistenceBound = "1";
    form.addEventListener("submit", persistKnownCode, true);
  }

  bindForm();
  document.addEventListener("DOMContentLoaded", bindForm, { once: true });
  window.addEventListener("pagehide", persistKnownCode);
  window.addEventListener("beforeunload", persistKnownCode);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") persistKnownCode();
  });
})();
