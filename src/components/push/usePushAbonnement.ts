"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import {
  deletePushSubscriptionAction,
  savePushSubscriptionAction,
  sendTestPushAction,
} from "@/lib/actions/push";

/**
 * LA PERMISSION NE SE DEMANDE QUE SUR UN GESTE : rien ne s'exécute au
 * chargement, `activer()` ne part que d'un tap. Une demande sans prévenir
 * reçoit un « non » réflexe, et Chrome ne repose jamais la question.
 */

/**
 * Au-delà, on considère que le service worker ne s'enregistrera pas.
 *
 * `navigator.serviceWorker.ready` ne se rejette JAMAIS : si
 * l'enregistrement a échoué (script introuvable, stockage plein,
 * navigation privée), elle attend indéfiniment, et « Activer » resterait
 * sans réponse ni message.
 */
const DELAI_SERVICE_WORKER_MS = 10_000;

async function enregistrementPret(): Promise<ServiceWorkerRegistration | null> {
  return Promise.race([
    navigator.serviceWorker.ready,
    new Promise<null>((resolve) => {
      setTimeout(() => resolve(null), DELAI_SERVICE_WORKER_MS);
    }),
  ]);
}

const SERVICE_WORKER_ABSENT =
  "Les notifications ne sont pas prêtes sur cet appareil. Rechargez la page, puis réessayez.";

export type PushAbonnement = {
  /** `null` tant que la vérification initiale n'a pas eu lieu. */
  supporte: boolean | null;
  permission: NotificationPermission;
  abonne: boolean;
  enCours: boolean;
  erreur: string | null;
  message: string | null;
  activer: () => Promise<void>;
  desactiver: () => Promise<void>;
  tester: () => void;
};

export function usePushAbonnement(): PushAbonnement {
  const [supporte, setSupporte] = useState<boolean | null>(null);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [abonne, setAbonne] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();

  useEffect(() => {
    const disponible =
      "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
    setSupporte(disponible);
    if (!disponible) return;

    setPermission(Notification.permission);

    // Même borne : sans elle, un appareil déjà abonné dont le service
    // worker tarde serait affiché comme non abonné.
    let vivant = true;
    enregistrementPret()
      .then(async (enregistrement) => {
        if (!enregistrement) return false;
        return Boolean(await enregistrement.pushManager.getSubscription());
      })
      .then((estAbonne) => {
        if (vivant) setAbonne(estAbonne);
      })
      .catch(() => {
        if (vivant) setAbonne(false);
      });
    return () => {
      vivant = false;
    };
  }, []);

  const activer = useCallback(async () => {
    setErreur(null);
    setMessage(null);

    const accord = await Notification.requestPermission();
    setPermission(accord);
    if (accord !== "granted") {
      setErreur("Notifications refusées. Vous pouvez les réactiver dans les réglages du site.");
      return;
    }

    const cle = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!cle) {
      setErreur("Notifications non configurées sur ce site.");
      return;
    }

    const enregistrement = await enregistrementPret();
    if (!enregistrement) {
      setErreur(SERVICE_WORKER_ABSENT);
      return;
    }

    // `userVisibleOnly: true` est obligatoire sur Chrome, qui refuse les
    // push silencieux. Contrainte partagée : rien ici ne se cache.
    let abonnement: PushSubscription;
    try {
      abonnement = await enregistrement.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: cle,
      });
    } catch {
      // `subscribe` rejette pour des raisons indistinguables ici (clé
      // refusée, service injoignable, quota) : mieux vaut le dire.
      setErreur("Abonnement impossible sur cet appareil. Réessayez plus tard.");
      return;
    }

    demarrer(async () => {
      const resultat = await savePushSubscriptionAction(
        abonnement.toJSON() as { endpoint: string; keys?: { p256dh?: string; auth?: string } },
        navigator.userAgent,
      );
      if (resultat.error) {
        setErreur(resultat.error);
        return;
      }
      setAbonne(true);
      setMessage("Notifications activées sur cet appareil.");
    });
  }, []);

  const desactiver = useCallback(async () => {
    setErreur(null);
    setMessage(null);

    const enregistrement = await enregistrementPret();
    if (!enregistrement) {
      setErreur(SERVICE_WORKER_ABSENT);
      return;
    }

    const abonnement = await enregistrement.pushManager.getSubscription();
    if (!abonnement) {
      setAbonne(false);
      return;
    }

    const endpoint = abonnement.endpoint;
    /* D'abord côté navigateur : l'ordre inverse laisserait, sur une
       coupure, un téléphone qui reçoit encore sans aucune ligne en base,
       donc impossible à faire taire depuis l'application. */
    await abonnement.unsubscribe();
    setAbonne(false);

    demarrer(async () => {
      const resultat = await deletePushSubscriptionAction(endpoint);
      if (resultat.error) setErreur(resultat.error);
      else setMessage("Notifications désactivées sur cet appareil.");
    });
  }, []);

  const tester = useCallback(() => {
    setErreur(null);
    setMessage(null);
    demarrer(async () => {
      const resultat = await sendTestPushAction();
      if (resultat.error) setErreur(resultat.error);
      else setMessage("Notification envoyée. Elle doit arriver dans quelques secondes.");
    });
  }, []);

  return { supporte, permission, abonne, enCours, erreur, message, activer, desactiver, tester };
}
