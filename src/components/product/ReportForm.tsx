"use client";

import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Field";
import { reportProductAction } from "@/lib/actions/messages";
import { useFormulaire } from "@/lib/use-formulaire";
import { PRECISIONS_MAX } from "@/lib/saisie";
import { ErreurChamp, ErreurGenerale, ErreursFormulaire } from "@/components/ui/ErreurChamp";

export function ReportForm({ productId, reasons }: { productId: string; reasons: string[] }) {
  const { state, formAction, onSubmit, pending } = useFormulaire(reportProductAction);

  return (
    <ErreursFormulaire etat={state}>
      <form action={formAction} onSubmit={onSubmit} className="flex flex-col gap-3.5">
        <input type="hidden" name="productId" value={productId} />
        <div data-champ="reason">
          {reasons.map((reason, index) => (
            <label
              key={reason}
              className="flex min-h-tap cursor-pointer items-center gap-3 border-b border-line py-2.5 last:border-b-0"
            >
              <input
                type="radio"
                name="reason"
                value={reason}
                defaultChecked={index === 0}
                required
                className="size-5 accent-accent"
              />
              <span className="text-base">{reason}</span>
            </label>
          ))}
          <ErreurChamp champ="reason" />
        </div>
        <div data-champ="details" className="flex flex-col gap-1.5">
          <Textarea name="details" maxLength={PRECISIONS_MAX} rows={3} placeholder="Précisez si besoin (facultatif)" aria-label="Précisions" />
          <ErreurChamp champ="details" />
        </div>
        <ErreurGenerale etat={state} />
        <Button type="submit" disabled={pending}>
          {pending ? "Envoi en cours" : "Envoyer le signalement"}
        </Button>
      </form>
    </ErreursFormulaire>
  );
}
