"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { changeMyPasswordAction, type ActionState } from "@/lib/actions/auth";

/**
 * Changer son mot de passe en le connaissant — panneau de l'écran compte.
 *
 * Le mot de passe ACTUEL prouve que c'est bien la personne : sans lui, un
 * téléphone emprunté trente secondes suffit à enfermer son propriétaire
 * dehors. Le NOUVEAU se tape deux fois, sa faute de frappe ne se
 * découvrant qu'à la connexion suivante.
 *
 * `autoComplete` distingue les deux rôles (`current-password` puis
 * `new-password`), sans quoi le gestionnaire du téléphone enregistre l'un
 * à la place de l'autre.
 */
export function ChangePasswordForm() {
  const [state, formAction, pending] = useActionState<ActionState | null, FormData>(changeMyPasswordAction, null);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <Field label="Mot de passe actuel" htmlFor="currentPassword">
        <Input
          id="currentPassword"
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          placeholder="Votre mot de passe d'aujourd'hui"
        />
      </Field>

      <Field label="Nouveau mot de passe" htmlFor="newPassword">
        <Input
          id="newPassword"
          name="newPassword"
          type="password"
          autoComplete="new-password"
          placeholder="8 caractères minimum"
        />
      </Field>

      <Field
        label="Confirmer le nouveau mot de passe"
        htmlFor="newPasswordConfirmation"
        hint="Retapez-le : c'est le seul champ qu'on ne peut pas relire."
      >
        <Input
          id="newPasswordConfirmation"
          name="newPasswordConfirmation"
          type="password"
          autoComplete="new-password"
          placeholder="Le même mot de passe"
        />
      </Field>

      {state?.error ? <p className="text-sm text-danger">{state.error}</p> : null}
      {state?.sent ? (
        <p className="text-sm font-semibold text-accent">
          Mot de passe modifié. Utilisez le nouveau à votre prochaine connexion.
        </p>
      ) : null}

      <Button type="submit" disabled={pending}>
        {pending ? "Enregistrement…" : "OK"}
      </Button>
    </form>
  );
}
