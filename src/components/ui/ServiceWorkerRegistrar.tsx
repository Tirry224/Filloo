"use client";

import { useEffect } from "react";

/**
 * Installe le service worker — et sait le désinstaller.
 *
 * L'installation est séparée de la PERMISSION : l'enregistrement ne demande
 * rien et dort jusqu'à ce qu'un abonnement push existe. La permission ne se
 * demande qu'au tap sur l'interrupteur — trop tôt, elle reçoit un « non »
 * définitif que Chrome ne repose plus.
 *
 * `?sw=off` désinstalle au lieu d'installer : le recours local décrit en
 * tête de `public/sw.js`, pour un téléphone qu'on a sous la main.
 *
 * Après `load` : l'enregistrement télécharge, et le faire pendant la
 * construction de la page vole de la bande passante à ce que la personne
 * attend (`docs/PERFORMANCE.md`).
 */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    const desinstaller = new URLSearchParams(window.location.search).get("sw") === "off";

    if (desinstaller) {
      navigator.serviceWorker.getRegistrations().then((enregistrements) => {
        enregistrements.forEach((e) => e.unregister());
        console.warn("[sw] désinstallé à la demande (?sw=off).");
      });
      return;
    }

    const installer = () => {
      navigator.serviceWorker.register("/sw.js").catch((cause) => {
        // Un échec n'empêche rien : seules les notifications manquent.
        // Journalisé sans rien montrer, une alerte inquiéterait pour rien.
        console.error("[sw] enregistrement impossible :", cause);
      });
    };

    if (document.readyState === "complete") {
      installer();
    } else {
      window.addEventListener("load", installer, { once: true });
      return () => window.removeEventListener("load", installer);
    }
  }, []);

  return null;
}
