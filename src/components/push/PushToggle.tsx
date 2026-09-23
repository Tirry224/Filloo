"use client";

import { BellRing } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { usePushAbonnement } from "@/components/push/usePushAbonnement";

/**
 * Trois états à distinguer :
 *   - pas supporté (iPhone dans Safari, navigateur ancien) : on le DIT
 *     avec la marche à suivre, sinon le bouton paraît cassé ;
 *   - permission refusée : le navigateur ne redemandera plus, seul le
 *     réglage du site rouvre la porte ;
 *   - abonné / non abonné : le cas normal.
 */
export function PushToggle() {
  const { supporte, permission, abonne, enCours, erreur, message, activer, desactiver, tester } =
    usePushAbonnement();

  if (supporte === null) return null;

  if (!supporte) {
    return (
      <p className="text-sm text-ink-soft">
        Ce navigateur ne gère pas les notifications. Sur iPhone, ajoutez d&apos;abord Filloo à votre
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
