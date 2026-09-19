"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { changeMyPasswordAction, type ActionState } from "@/lib/actions/auth";

/**
 * Changer son mot de passe en le connaissant — panneau de l'écran compte.
 *
 * TROIS CHAMPS, ET CHACUN A SA RAISON
 * Le mot de passe ACTUEL prouve que c'est bien la personne : sans lui, un
 * téléphone déverrouillé emprunté trente secondes suffit à enfermer son
 * propriétaire dehors. Le NOUVEAU se tape DEUX fois parce que c'est le
 * seul champ du parcours qu'on ne peut pas relire — et qu'une faute de
 * frappe ne se découvre qu'à la connexion suivante, quand plus rien ne
 * rappelle ce qu'on croyait avoir écrit.
 *
 * POURQUOI ÇA NE REDIRIGE PAS
 * Le formulaire vit dans un panneau posé sur l'écran de compte. Renvoyer
 * ailleurs après un succès donnerait l'impression d'avoir perdu sa place
 * pour un geste de dix secondes. Le panneau dit que c'est fait, la
 * personne referme.
 *
 * `autoComplete` distingue bien les deux rôles : `current-password` sur le
 * premier, `new-password` sur les suivants. C'est ce qui permet au
 * gestionnaire de mots de passe du téléphone de proposer l'ancien au bon
 * endroit, et d'enregistrer le nouveau — sans ça, il enregistre souvent
 * l'un à la place de l'autre.
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
