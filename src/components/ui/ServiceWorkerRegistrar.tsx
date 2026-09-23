"use client";

import { useEffect } from "react";

/**
 * L'installation est séparée de la PERMISSION : l'enregistrement ne demande
 * rien et dort jusqu'à ce qu'un abonnement push existe. La permission ne se
 * demande qu'au tap sur l'interrupteur — trop tôt, elle reçoit un « non »
 * définitif que Chrome ne repose plus.
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
