"use client";

import { Send } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Field, Textarea } from "@/components/ui/Field";
import { ecrireALEquipeAction } from "@/lib/actions/equipe";
import type { Espace } from "@/lib/espace";
import { useFormulaire } from "@/lib/use-formulaire";

/** Le message à l'équipe. Un refus ou une coupure réseau garde la saisie (`useFormulaire`). */
export function FormulaireEquipe({ espace, annonceId }: { espace: Espace; annonceId?: string }) {
  const { state, formAction, onSubmit, pending } = useFormulaire(ecrireALEquipeAction);
  return (
    <form action={formAction} onSubmit={onSubmit} className="flex flex-col gap-4">
      <input type="hidden" name="espace" value={espace} />
      {annonceId ? <input type="hidden" name="annonceId" value={annonceId} /> : null}
      <Field label="Votre message" htmlFor="corps" hint="Une personne de l'équipe vous répondra dans « Équipe Filloo ».">
        <Textarea
          id="corps"
          name="corps"
          rows={7}
          maxLength={2000}
          required
          autoFocus
          placeholder="Une question, une idée, un problème…"
        />
      </Field>
      {state?.error ? <p className="text-sm text-danger">{state.error}</p> : null}
      <Button type="submit" icon={Send} disabled={pending}>
        {pending ? "Envoi…" : "Envoyer à l'équipe"}
      </Button>
    </form>
  );
}
