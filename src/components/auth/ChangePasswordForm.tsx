"use client";

import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { LONGUEUR_MIN_MOT_DE_PASSE } from "@/lib/password";
import { changeMyPasswordAction } from "@/lib/actions/auth";
import { useFormulaire } from "@/lib/use-formulaire";

/**
 * Le mot de passe ACTUEL prouve que c'est bien la personne : sans lui, un
 * téléphone emprunté trente secondes suffit à enfermer son propriétaire
 * dehors.
 *
 * `autoComplete` distingue les deux rôles (`current-password` puis
 * `new-password`), sans quoi le gestionnaire du téléphone enregistre l'un
 * à la place de l'autre.
 */
export function ChangePasswordForm() {
  const { state, formAction, onSubmit, pending } = useFormulaire(changeMyPasswordAction);
  const formulaire = useRef<HTMLFormElement>(null);

  // La saisie est gardée après une ERREUR ; après un succès, trois mots de
  // passe n'ont plus rien à faire à l'écran.
  useEffect(() => {
    if (state?.sent) formulaire.current?.reset();
  }, [state]);

  return (
    <form ref={formulaire} action={formAction} onSubmit={onSubmit} className="flex flex-col gap-4">
      <Field label="Mot de passe actuel" htmlFor="currentPassword">
        <PasswordInput
          id="currentPassword"
          name="currentPassword"
          autoComplete="current-password"
          placeholder="Mot de passe actuel"
        />
      </Field>

      <Field label="Nouveau mot de passe" htmlFor="newPassword">
        <PasswordInput
          id="newPassword"
          name="newPassword"
          autoComplete="new-password"
          placeholder={`${LONGUEUR_MIN_MOT_DE_PASSE} caractères, dont un chiffre`}
        />
      </Field>

      <Field
        label="Confirmer le nouveau mot de passe"
        htmlFor="newPasswordConfirmation"
        hint="Retapez-le, pour éviter une faute de frappe."
      >
        <PasswordInput
          id="newPasswordConfirmation"
          name="newPasswordConfirmation"
          autoComplete="new-password"
          placeholder="Confirmer le mot de passe"
        />
      </Field>

      {state?.error ? <p className="text-sm text-danger">{state.error}</p> : null}
      {state?.sent ? (
        <p className="text-sm font-semibold text-accent">
          Mot de passe modifié. Utilisez le nouveau à votre prochaine connexion.
        </p>
      ) : null}

      <Button type="submit" disabled={pending}>
        {pending ? "Enregistrement en cours" : "OK"}
      </Button>
    </form>
  );
}
