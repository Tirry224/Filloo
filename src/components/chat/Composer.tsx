"use client";

import { useEffect, useRef } from "react";
import { Plus, SendHorizontal } from "lucide-react";
import Link from "next/link";
import { sendMessageAction } from "@/lib/actions/messages";
import { useFormulaire } from "@/lib/use-formulaire";

/** La borne de `messages.body` (0001) : au-delà, la base refuse. */
const LONGUEUR_MAX_MESSAGE = 2000;

export function Composer({
  conversationId,
  basePath,
  citingProductId,
  disabled = false,
}: {
  conversationId: string;
  basePath: string;
  citingProductId?: string;
  disabled?: boolean;
}) {
  /* Le champ se vide DÈS l'envoi, comme dans toute messagerie, et le
     texte revient si l'envoi échoue (réseau, fil fermé, quota). Avant, la
     remise à zéro de React effaçait aussi un message REFUSÉ : 2 400
     caractères tapés disparaissaient avec l'erreur (2026-09-25). */
  const brouillon = useRef("");
  const champ = useRef<HTMLInputElement>(null);
  const { state, formAction, onSubmit, pending } = useFormulaire(sendMessageAction, {
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
        <input type="hidden" name="conversationId" value={conversationId} />
        {citingProductId ? <input type="hidden" name="productId" value={citingProductId} /> : null}
        <Link
          href={`${basePath}/${conversationId}/citer`}
          aria-label="Joindre un produit"
          className="flex size-tap shrink-0 items-center justify-center rounded-full border border-line text-ink-soft"
        >
          <Plus size={21} strokeWidth={2} aria-hidden />
        </Link>
        <input
          ref={champ}
          name="body"
          maxLength={LONGUEUR_MAX_MESSAGE}
          className="h-tap flex-1 rounded-full border border-line bg-surface px-4 text-base disabled:opacity-50"
          placeholder={disabled ? "Choisissez un produit pour démarrer" : "Écrire un message…"}
          aria-label="Votre message"
          required
          disabled={pending || disabled}
        />
        <button
          type="submit"
          aria-label="Envoyer"
          disabled={pending || disabled}
          className="flex size-tap shrink-0 items-center justify-center rounded-full bg-accent text-on-accent disabled:opacity-50"
        >
          <SendHorizontal size={20} strokeWidth={1.9} aria-hidden />
        </button>
      </form>
    </div>
  );
}
