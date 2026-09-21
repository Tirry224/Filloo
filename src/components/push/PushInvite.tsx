"use client";

import { BellRing } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { usePushAbonnement } from "@/components/push/usePushAbonnement";

/**
 * La carte qui PROPOSE les notifications, au lieu d'attendre qu'on aille
 * chercher l'interrupteur du menu — replié dans une liste de réglages, il
 * n'était activé par personne.
 *
 * Elle ne demande rien toute seule : la permission du navigateur n'est
 * demandée qu'au tap, par `usePushAbonnement`.
 *
 * Elle disparaît d'elle-même une fois l'appareil abonné ou la permission
 * refusée ; l'interrupteur du menu reste le seul endroit où revenir sur sa
 * décision. Une invitation qui survit à la réponse est une nuisance.
 */
export function PushInvite({
  /** L'argument, différent des deux côtés : un commerçant perd une vente,
   *  un client perd une réponse. */
  raison,
}: {
  raison: string;
}) {
  const { supporte, permission, abonne, enCours, erreur, message, activer } = usePushAbonnement();

  // Rien avant la vérification initiale : une carte qui apparaît puis
  // disparaît fait sauter l'écran sous le pouce.
  if (supporte === null || !supporte) return null;
  if (permission === "denied") return null;

  if (abonne) {
    // Après activation, la carte confirme au lieu de s'évaporer, puis ne
    // revient plus au rechargement suivant.
    return message ? <p className="text-sm font-semibold text-accent">{message}</p> : null;
  }

  return (
    <Card padded className="flex flex-col gap-2.5">
      <div className="flex items-center gap-2.5">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent">
          <BellRing size={20} strokeWidth={1.8} aria-hidden />
        </div>
        <span className="text-base font-bold">Activez les notifications</span>
      </div>
      <p className="text-sm leading-normal text-ink-soft">{raison}</p>
      <Button size="sm" onClick={activer} disabled={enCours}>
        Activer sur cet appareil
      </Button>
      {erreur ? <p className="text-sm text-danger">{erreur}</p> : null}
    </Card>
  );
}
