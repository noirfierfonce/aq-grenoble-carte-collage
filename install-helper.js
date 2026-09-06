(() => {
  "use strict";

  let deferredPrompt = null;

  const isStandalone = () =>
    window.matchMedia?.("(display-mode: standalone)")?.matches ||
    window.navigator.standalone === true;

  const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent);
  const isMobile = () => /android|iphone|ipad|ipod/i.test(navigator.userAgent);

  function getButton() {
    return document.getElementById("installBtn");
  }

  function configureButton() {
    const button = getButton();
    if (!button) return;

    if (isStandalone()) {
      button.hidden = true;
      return;
    }

    button.hidden = false;
    button.textContent = "⬇ Installer l’app.";
    button.onclick = installOrExplain;
  }

  async function installOrExplain() {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      deferredPrompt = null;
      if (choice?.outcome === "accepted") {
        const button = getButton();
        if (button) button.hidden = true;
      }
      return;
    }

    showInstallHelp();
  }

  function showInstallHelp() {
    document.getElementById("installHelpModal")?.remove();

    const modal = document.createElement("div");
    modal.id = "installHelpModal";
    modal.className = "access-modal";

    let instructions = "";
    if (isIOS()) {
      instructions = "Sur iPhone ou iPad : ouvre cette page dans Safari, touche Partager, puis « Sur l’écran d’accueil ». L’icône AQ Collage apparaîtra comme une application.";
    } else if (isMobile()) {
      instructions = "Sur Android : ouvre le menu du navigateur (⋮), puis choisis « Installer l’application » ou « Ajouter à l’écran d’accueil ». L’icône AQ Collage apparaîtra sur ton écran d’accueil.";
    } else {
      instructions = "Sur ordinateur : dans Chrome ou Edge, utilise l’icône d’installation à droite de la barre d’adresse, ou le menu du navigateur puis « Installer l’application ». L’application pourra ensuite être épinglée au bureau, au menu Démarrer ou à la barre des tâches.";
    }

    const card = document.createElement("div");
    card.className = "access-card";
    card.innerHTML = `
      <h2>Installer AQ Collage.</h2>
      <p>${instructions}</p>
      <p>Une fois installée, elle s’ouvre dans sa propre fenêtre, sans passer par le navigateur comme un simple onglet.</p>
      <button type="button" id="closeInstallHelp">Fermer.</button>
    `;

    modal.appendChild(card);
    document.body.appendChild(modal);

    card.querySelector("#closeInstallHelp")?.addEventListener("click", () => modal.remove());
    modal.addEventListener("click", event => {
      if (event.target === modal) modal.remove();
    });
  }

  window.addEventListener("beforeinstallprompt", event => {
    event.preventDefault();
    deferredPrompt = event;
    configureButton();
  });

  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    const button = getButton();
    if (button) button.hidden = true;
  });

  document.addEventListener("DOMContentLoaded", configureButton);
})();
