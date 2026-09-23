"use client";

import { BellRing } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { usePushAbonnement } from "@/components/push/usePushAbonnement";

/**
 * Elle ne demande rien toute seule : la permission du navigateur n'est
 * demandée qu'au tap, par `usePushAbonnement`.
 */
export function PushInvite({
  raison,
}: {
  raison: string;
}) {
  const { supporte, permission, abonne, enCours, erreur, message, activer } = usePushAbonnement();

  if (supporte === null || !supporte) return null;
  if (permission === "denied") return null;

  if (abonne) {
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
