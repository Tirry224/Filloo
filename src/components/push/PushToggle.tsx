"use client";

import { useEffect, useState, useTransition } from "react";
import { BellRing } from "lucide-react";
import { Button } from "@/components/ui/Button";
import {
  deletePushSubscriptionAction,
  savePushSubscriptionAction,
  sendTestPushAction,
} from "@/lib/actions/push";

/**
 * L'interrupteur des notifications, et tout ce qu'il doit dire.
 *
 * LA PERMISSION NE SE DEMANDE QU'ICI, SUR UN GESTE
 * Un navigateur à qui l'on demande la permission au chargement reçoit un
 * « non » réflexe — et Chrome ne repose JAMAIS la question ensuite : la
 * personne est perdue pour les notifications, définitivement, sans avoir
 * compris ce qu'on lui proposait. On ne la demande donc qu'après un tap
 * délibéré sur ce bouton, quand la phrase au-dessus a expliqué à quoi ça
 * sert.
 *
 * TROIS ÉTATS À DISTINGUER, ET C'EST TOUT L'INTÉRÊT DU COMPOSANT
 *   - pas supporté (iPhone ouvert dans Safari, navigateur ancien) : on le
 *     DIT, avec ce qu'il faut faire — sinon la personne touche un bouton
 *     qui ne répond pas et conclut que l'application est cassée ;
 *   - permission refusée : le navigateur ne redemandera plus, seul le
 *     réglage du site peut la rouvrir. Le bouton ne servirait à rien ;
 *   - abonné / non abonné : le cas normal.
 *
 * POURQUOI LE BOUTON DE TEST RESTE APRÈS LA MISE AU POINT
 * Le jour où un commerçant dira « je ne reçois rien », ce bouton répondra
 * en trois secondes : soit la notification arrive et le problème est
 * ailleurs, soit elle n'arrive pas et on sait où chercher. Un diagnostic
 * qui demande un deuxième téléphone et un deuxième compte ne se fait pas.
 */
export function PushToggle() {
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
    navigator.serviceWorker.ready
      .then((enregistrement) => enregistrement.pushManager.getSubscription())
      .then((abonnement) => setAbonne(Boolean(abonnement)))
      .catch(() => setAbonne(false));
  }, []);

  async function activer() {
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

    const enregistrement = await navigator.serviceWorker.ready;
    /* `userVisibleOnly: true` est OBLIGATOIRE sur Chrome : le navigateur
       refuse les push silencieux, précisément pour qu'on ne puisse pas
       réveiller un téléphone en douce. C'est une contrainte qu'on partage
       — Makiti n'a rien à envoyer qui ne se montre pas. */
    const abonnement = await enregistrement.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: cle,
    });

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
  }

  async function desactiver() {
    setErreur(null);
    setMessage(null);

    const enregistrement = await navigator.serviceWorker.ready;
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
  }

  function tester() {
    setErreur(null);
    setMessage(null);
    demarrer(async () => {
      const resultat = await sendTestPushAction();
      if (resultat.error) setErreur(resultat.error);
      else setMessage("Notification envoyée. Elle doit arriver dans quelques secondes.");
    });
  }

  if (supporte === null) return null;

  if (!supporte) {
    return (
      <p className="text-sm text-ink-soft">
        Ce navigateur ne gère pas les notifications. Sur iPhone, ajoutez d&apos;abord Makiti à votre
        écran d&apos;accueil (bouton Partager, puis « Sur l&apos;écran d&apos;accueil »), puis
        rouvrez-la depuis là.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3.5">
      <p className="text-sm text-ink-soft">
        Recevez une alerte sur cet appareil dès qu&apos;un message arrive, même application fermée.
        L&apos;email continue de partir dans tous les cas.
      </p>

      {permission === "denied" ? (
        <p className="text-sm text-danger">
          Les notifications sont bloquées pour ce site. Le navigateur ne redemandera pas : il faut
          les réautoriser dans ses réglages, à la ligne « Notifications ».
        </p>
      ) : abonne ? (
        <>
          <Button variant="secondary" icon={BellRing} onClick={tester} disabled={enCours}>
            M&apos;envoyer une notification test
          </Button>
          <Button variant="danger" onClick={desactiver} disabled={enCours}>
            Désactiver sur cet appareil
          </Button>
        </>
      ) : (
        <Button icon={BellRing} onClick={activer} disabled={enCours}>
          Activer sur cet appareil
        </Button>
      )}

      {erreur ? <p className="text-sm text-danger">{erreur}</p> : null}
      {message ? <p className="text-sm font-semibold text-accent">{message}</p> : null}
    </div>
  );
}
