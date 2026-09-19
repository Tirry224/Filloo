"use client";

import { useEffect } from "react";

/**
 * Installe le service worker — et sait le désinstaller.
 *
 * POURQUOI L'INSTALLATION EST SÉPARÉE DE LA PERMISSION
 * Enregistrer le service worker ne demande RIEN à la personne : aucune
 * boîte de dialogue, aucune permission. Il dort jusqu'à ce qu'un
 * abonnement push existe. La permission de notifier, elle, se demandera
 * plus tard, au moment où la personne touchera l'interrupteur — jamais au
 * chargement. Un navigateur à qui l'on demande la permission trop tôt
 * reçoit un « non » définitif : Chrome ne repose plus la question.
 *
 * `?sw=off` : LE RECOURS LOCAL
 * Ouvrir l'application avec ce paramètre désinstalle le service worker au
 * lieu de l'installer. C'est le deuxième des trois recours décrits en
 * tête de `public/sw.js` — celui qu'on utilise sur un téléphone qu'on a
 * sous la main. Le vrai recours général reste de vider `sw.js` et de
 * déployer.
 *
 * POURQUOI APRÈS LE CHARGEMENT (`load`)
 * L'enregistrement déclenche un téléchargement. Le faire pendant que la
 * page se construit vole de la bande passante à ce que la personne
 * attend vraiment — et sur une connexion guinéenne, cette seconde-là se
 * voit (`docs/PERFORMANCE.md`).
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
        /* Un échec ici n'empêche RIEN : sans service worker, Makiti
           fonctionne exactement comme avant, seules les notifications
           manquent. On le journalise sans rien montrer à l'écran — une
           alerte pour une fonctionnalité optionnelle inquiéterait pour
           rien. */
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
