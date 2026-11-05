"use client";

import { useEffect, useRef } from "react";
import { SendHorizontal } from "lucide-react";
import { ecrireALEquipeAction } from "@/lib/actions/equipe";
import type { Espace } from "@/lib/espace";
import { useFormulaire } from "@/lib/use-formulaire";

/**
 * Répondre à l'équipe, sous sa réponse : le champ de la messagerie du
 * site. Le message va dans le même fil ; un refus ou une coupure réseau
 * rend le texte au champ.
 */
export function RepondreEquipe({ espace, reponseA }: { espace: Espace; reponseA: string }) {
  const brouillon = useRef("");
  const champ = useRef<HTMLInputElement>(null);
  const { state, formAction, onSubmit, pending } = useFormulaire(ecrireALEquipeAction, {
    avantEnvoi: () => {
      if (!champ.current) return;
      brouillon.current = champ.current.value;
      champ.current.value = "";
    },
  });
  useEffect(() => {
    if (state?.error && champ.current && !champ.current.value) champ.current.value = brouillon.current;
  }, [state]);

  return (
    <div className="flex flex-col gap-1.5">
      {state?.error ? <p className="text-center text-xs text-danger">{state.error}</p> : null}
      <form action={formAction} onSubmit={onSubmit} className="flex items-center gap-2.5">
        <input type="hidden" name="espace" value={espace} />
        <input type="hidden" name="reponseA" value={reponseA} />
        <input
          ref={champ}
          name="corps"
          maxLength={2000}
          required
          autoComplete="off"
          aria-label="Votre réponse"
          placeholder="Répondre à l'équipe"
          disabled={pending}
          className="h-tap flex-1 rounded-full border border-line bg-surface px-4 text-base disabled:opacity-50"
        />
        <button
          type="submit"
          aria-label="Envoyer"
          disabled={pending}
          className="flex size-tap shrink-0 cursor-pointer items-center justify-center rounded-full bg-accent text-on-accent disabled:opacity-50"
        >
          <SendHorizontal size={20} strokeWidth={1.9} aria-hidden />
        </button>
      </form>
    </div>
  );
}
