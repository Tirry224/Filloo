"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { deletePushSubscriptionAction, savePushSubscriptionAction } from "@/lib/actions/push";

/**
 * LA PERMISSION NE SE DEMANDE QUE SUR UN GESTE : un tap sur la cloche, ou
 * sur « Créer mon compte » (`demanderPermissionPush`). Une demande au
 * chargement reçoit un « non » réflexe, et Chrome ne repose jamais la
 * question.
 *
 * L'ABONNEMENT, lui, peut partir seul (`auto`) : une fois la permission
 * accordée, s'abonner n'affiche rien. C'est ce qui rend les notifications
 * actives dès l'arrivée du nouveau compte (décision du 2026-10-23).
 */

/** Posée quand la personne coupe la cloche : sans elle, `auto`
 *  réabonnerait l'appareil au chargement suivant, la permission du
 *  navigateur restant accordée. */
const CLE_COUPE = "filloo-notifications-coupees";

function lireCoupe(): boolean {
  try {
    return localStorage.getItem(CLE_COUPE) === "1";
  } catch {
    return false;
  }
}

function ecrireCoupe(coupe: boolean) {
  try {
    if (coupe) localStorage.setItem(CLE_COUPE, "1");
    else localStorage.removeItem(CLE_COUPE);
  } catch {
    // Navigation privée : le choix ne survivra pas, rien de plus.
  }
}

/**
 * À appeler DANS le gestionnaire d'un tap : c'est le geste qui autorise
 * la demande. Jamais attendue — l'inscription ne doit pas patienter
 * derrière la fenêtre du navigateur.
 */
export function demanderPermissionPush() {
  if (!("Notification" in window) || Notification.permission !== "default") return;
  ecrireCoupe(false);
  void Notification.requestPermission().catch(() => {});
}

/**
 * Au-delà, on considère que le service worker ne s'enregistrera pas.
 *
 * `navigator.serviceWorker.ready` ne se rejette JAMAIS : si
 * l'enregistrement a échoué (script introuvable, stockage plein,
 * navigation privée), elle attend indéfiniment, et « Activer » resterait
 * sans réponse ni message.
 */
const DELAI_SERVICE_WORKER_MS = 10_000;

/**
 * Un abonnement créé avec une autre clé VAPID ne reçoit plus rien, et
 * `subscribe` le rejette tant qu'il existe : il faut le reconnaître pour
 * le remplacer.
 */
function memeCle(abonnement: PushSubscription, cle: string): boolean {
  const brute = abonnement.options.applicationServerKey;
  if (!brute) return false;
  const base64 = btoa(String.fromCharCode(...new Uint8Array(brute)));
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "") === cle;
}

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
  activer: (options?: { silencieux?: boolean }) => Promise<void>;
  desactiver: () => Promise<void>;
};

export function usePushAbonnement({ auto = false }: { auto?: boolean } = {}): PushAbonnement {
  const [supporte, setSupporte] = useState<boolean | null>(null);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [abonne, setAbonne] = useState(false);
  /** Fin de la vérification initiale : avant, `abonne` vaut `false` par défaut, pas par constat. */
  const [verifie, setVerifie] = useState(false);
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
        const abonnement = await enregistrement.pushManager.getSubscription();
        const cle = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
        const estAbonne = Boolean(abonnement && cle && memeCle(abonnement, cle));
        /* Le navigateur peut se croire abonné alors que la base a perdu la
           ligne (compte changé sur ce téléphone, ligne purgée après un
           410) : le serveur n'avait alors personne à qui envoyer, et le
           bouton restait « Activé ». On réenregistre en silence ; l'upsert
           rend le geste sans effet quand la ligne existe déjà. */
        if (estAbonne && abonnement) {
          void savePushSubscriptionAction(
            abonnement.toJSON() as { endpoint: string; keys?: { p256dh?: string; auth?: string } },
            navigator.userAgent,
          ).catch(() => {});
        }
        return estAbonne;
      })
      .then((estAbonne) => {
        if (vivant) setAbonne(estAbonne);
      })
      .catch(() => {
        if (vivant) setAbonne(false);
      })
      .finally(() => {
        if (vivant) setVerifie(true);
      });
    return () => {
      vivant = false;
    };
  }, []);

  const activer = useCallback(async ({ silencieux = false }: { silencieux?: boolean } = {}) => {
    setErreur(null);
    setMessage(null);
    /* L'abonnement automatique ne parle pas : une erreur affichée au
       chargement, sans que personne n'ait rien demandé, inquiéterait. */
    const signaler = silencieux ? () => {} : setErreur;

    // Déjà accordée, `requestPermission` répond aussitôt, sans fenêtre.
    const accord = await Notification.requestPermission();
    setPermission(accord);
    if (accord !== "granted") {
      signaler("Notifications refusées. Vous pouvez les réactiver dans les réglages du site.");
      return;
    }
    ecrireCoupe(false);

    const cle = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!cle) {
      signaler("Notifications non configurées sur ce site.");
      return;
    }

    const enregistrement = await enregistrementPret();
    if (!enregistrement) {
      signaler(SERVICE_WORKER_ABSENT);
      return;
    }

    // `userVisibleOnly: true` est obligatoire sur Chrome, qui refuse les
    // push silencieux. Contrainte partagée : rien ici ne se cache.
    let abonnement: PushSubscription;
    try {
      const ancien = await enregistrement.pushManager.getSubscription();
      if (ancien && !memeCle(ancien, cle)) await ancien.unsubscribe();
      abonnement = await enregistrement.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: cle,
      });
    } catch {
      // `subscribe` rejette pour des raisons indistinguables ici (clé
      // refusée, service injoignable, quota) : mieux vaut le dire.
      signaler("Abonnement impossible sur cet appareil. Réessayez plus tard.");
      return;
    }

    demarrer(async () => {
      const resultat = await savePushSubscriptionAction(
        abonnement.toJSON() as { endpoint: string; keys?: { p256dh?: string; auth?: string } },
        navigator.userAgent,
      );
      if (resultat.error) {
        signaler(resultat.error);
        return;
      }
      setAbonne(true);
      if (!silencieux) setMessage("Notifications activées sur cet appareil.");
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

    ecrireCoupe(true);
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

  /* Abonnement automatique : seulement si la permission est DÉJÀ
     accordée (à l'inscription, ou sur un autre écran), que l'appareil
     n'est pas abonné, et que la personne n'a pas coupé la cloche. */
  useEffect(() => {
    if (!auto || !verifie || abonne || permission !== "granted" || lireCoupe()) return;
    void activer({ silencieux: true });
  }, [auto, verifie, abonne, permission, activer]);

  return { supporte, permission, abonne, enCours, erreur, message, activer, desactiver };
}
