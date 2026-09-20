"use client";

import { useEffect } from "react";

/**
 * Installe le service worker — et sait le désinstaller.
 *
 * INSTALLATION SÉPARÉE DE LA PERMISSION : l'enregistrement ne demande
 * RIEN et dort jusqu'à ce qu'un abonnement push existe. La permission de
 * notifier ne se demande qu'au tap sur l'interrupteur, jamais au
 * chargement : demandée trop tôt, elle reçoit un « non » définitif que
 * Chrome ne repose plus.
 *
 * `?sw=off` désinstalle au lieu d'installer : le recours local des trois
 * décrits en tête de `public/sw.js`, pour un téléphone qu'on a sous la
 * main. Le recours général reste de vider `sw.js` et de déployer.
 *
 * APRÈS `load` : l'enregistrement déclenche un téléchargement, et le
 * faire pendant la construction de la page vole de la bande passante à ce
 * que la personne attend (`docs/PERFORMANCE.md`).
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
        /* Un échec n'empêche RIEN : sans service worker, seules les
           notifications manquent. Journalisé sans rien montrer — une
           alerte pour une option inquiéterait pour rien. */
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
