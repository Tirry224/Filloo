"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import {
  deletePushSubscriptionAction,
  savePushSubscriptionAction,
  sendTestPushAction,
} from "@/lib/actions/push";

/**
 * Tout ce qu'un écran a besoin de savoir et de faire sur l'abonnement
 * push de CET appareil.
 *
 * POURQUOI CE FICHIER EXISTE
 * Deux composants commandent le même abonnement : `PushToggle`, dans le
 * panneau « Notifications », et `PushInvite`, la carte qui le propose à
 * quelqu'un qui n'a rien activé. Recopier la séquence — permission,
 * `subscribe`, action serveur, état — dans les deux, c'est se garantir
 * qu'un jour l'un demandera la permission autrement que l'autre. La
 * séquence vit donc ici, une fois.
 *
 * LA PERMISSION NE SE DEMANDE QUE SUR UN GESTE, ET C'EST UNE RÈGLE
 * Aucune fonction de ce fichier ne s'exécute au chargement : `activer()`
 * ne part que d'un tap. Un navigateur à qui l'on demande la permission
 * sans prévenir reçoit un « non » réflexe, et Chrome ne repose JAMAIS la
 * question — la personne est perdue pour les notifications sans avoir
 * compris ce qu'on lui proposait.
 */

/**
 * Au-delà, on considère que le service worker ne s'enregistrera pas.
 *
 * `navigator.serviceWorker.ready` est une promesse qui ne se rejette
 * JAMAIS : si l'enregistrement a échoué — script introuvable, stockage
 * plein, navigateur en navigation privée — elle attend indéfiniment.
 * Sans cette borne, toucher « Activer » ne produisait donc rien du tout :
 * pas d'erreur, pas de message, pas de changement d'état. Un bouton qui
 * ne répond pas est lu comme une application cassée, ce qui est pire que
 * l'aveu d'un échec.
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
  /** `null` tant que la vérification initiale n'a pas eu lieu : rien ne
   *  doit s'afficher avant, ni interrupteur ni invitation. */
  supporte: boolean | null;
  permission: NotificationPermission;
  abonne: boolean;
  /** Un appel est en cours ; les boutons se désactivent. */
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

    /* Même borne qu'ailleurs : sans elle, un service worker qui ne
       s'enregistre pas laissait `abonne` à `false` par défaut — ce qui
       tombait juste par accident, mais n'aurait rien dit d'un appareil
       DÉJÀ abonné dont le service worker tarde. */
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

    /* `userVisibleOnly: true` est OBLIGATOIRE sur Chrome : le navigateur
       refuse les push silencieux, précisément pour qu'on ne puisse pas
       réveiller un téléphone en douce. C'est une contrainte qu'on partage
       — Makiti n'a rien à envoyer qui ne se montre pas. */
    let abonnement: PushSubscription;
    try {
      abonnement = await enregistrement.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: cle,
      });
    } catch {
      /* `subscribe` rejette pour des raisons qu'on ne peut pas distinguer
         ici (clé refusée, service de push injoignable, quota du
         navigateur). Le dire platement vaut mieux que laisser un bouton
         sans effet. */
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
    /* On se désabonne D'ABORD côté navigateur. L'ordre inverse laisserait,
       en cas de coupure entre les deux, un téléphone qui reçoit encore des
       notifications sans aucune ligne en base pour l'expliquer — donc
       impossible à faire taire depuis l'application. */
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
