"use client";

import { BellRing } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { usePushAbonnement } from "@/components/push/usePushAbonnement";

/**
 * La carte qui PROPOSE les notifications, au lieu d'attendre qu'on les
 * trouve.
 *
 * POURQUOI ELLE EXISTE
 * L'interrupteur existait déjà, replié dans le panneau « Notifications »
 * d'une liste de réglages. Une fonctionnalité qu'il faut aller chercher
 * dans un menu n'est activée par personne — et des notifications que
 * personne n'active ne se distinguent en rien de notifications qu'on
 * n'aurait pas écrites. Le service worker, la table `0023` et l'envoi
 * serveur ne servent qu'à partir du moment où quelqu'un dit oui.
 *
 * ELLE NE DEMANDE RIEN TOUTE SEULE
 * Elle affiche un bouton ; la permission du navigateur n'est demandée
 * qu'au tap, par `usePushAbonnement`. C'est la même règle que partout
 * ailleurs dans ce dossier, et c'est ce qui la distingue d'une
 * sollicitation : elle explique d'abord, elle demande ensuite.
 *
 * ELLE DISPARAÎT D'ELLE-MÊME
 * Dès que l'appareil est abonné, ou si la permission a déjà été refusée,
 * il n'y a plus rien à proposer — l'interrupteur du menu reste le seul
 * endroit où revenir sur sa décision. Une invitation qui survit à la
 * réponse devient une nuisance, et c'est comme ça qu'on se fait couper
 * les notifications pour de bon.
 */
export function PushInvite({
  /** L'argument, qui n'est pas le même des deux côtés : un commerçant
   *  perd une vente, un client perd une réponse. */
  raison,
}: {
  raison: string;
}) {
  const { supporte, permission, abonne, enCours, erreur, message, activer } = usePushAbonnement();

  /* Rien tant que la vérification initiale n'a pas eu lieu : une carte
     qui apparaît puis disparaît au chargement fait sauter l'écran sous
     le pouce. */
  if (supporte === null || !supporte) return null;
  if (permission === "denied") return null;

  if (abonne) {
    /* Après l'activation, la carte ne s'évapore pas en silence : elle
       confirme, puis ne reviendra plus (au rechargement suivant,
       `abonne` est vrai dès le départ et `message` est vide). Une action
       dont on ne voit pas le résultat est une action dont on doute. */
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
