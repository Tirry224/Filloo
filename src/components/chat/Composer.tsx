"use client";

import { useActionState } from "react";
import { Plus, SendHorizontal } from "lucide-react";
import Link from "next/link";
import { sendMessageAction } from "@/lib/actions/messages";
import type { ActionState } from "@/lib/actions/auth";

/**
 * Champ de saisie du fil. Contrairement aux formulaires vendeur (étape 2),
 * celui-ci exige du JavaScript : sans `useActionState`, un dépassement de
 * quota ou un blocage échouerait en silence — le formulaire se
 * soumettrait, la page se rafraîchirait, et rien ne dirait pourquoi le
 * message a disparu. Gap déjà documenté dans docs/REPRISE.md.
 */
export function Composer({
  conversationId,
  basePath,
  citingProductId,
  disabled = false,
}: {
  conversationId: string;
  /** Racine de la messagerie de l'espace courant (`/messages` ou
   *  `/vendeur/messages`) : sans elle, « citer un produit » faisait
   *  sortir le commerçant de son espace au milieu d'une réponse. */
  basePath: string;
  citingProductId?: string;
  disabled?: boolean;
}) {
  const [state, formAction, pending] = useActionState<ActionState | null, FormData>(sendMessageAction, null);

  return (
    <div className="flex flex-col gap-1.5">
      {state?.error ? <p className="text-center text-xs text-danger">{state.error}</p> : null}
      <form action={formAction} className="flex items-center gap-2.5">
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
          name="body"
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
