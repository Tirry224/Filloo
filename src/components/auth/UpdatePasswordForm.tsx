"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { updatePasswordAction, type ActionState } from "@/lib/actions/auth";

export function UpdatePasswordForm() {
  const [state, formAction, pending] = useActionState<ActionState | null, FormData>(updatePasswordAction, null);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <Field label="Nouveau mot de passe" htmlFor="password">
        <Input id="password" name="password" type="password" autoComplete="new-password" placeholder="8 caractères minimum" />
      </Field>

      {/* La double saisie compte double sur cet écran : il s'ouvre depuis
          un lien reçu par email, et ce lien ne sert qu'une fois. Un mot de
          passe mal tapé ici oblige à redemander un email, donc à refaire
          tout le trajet — pour une frappe qu'on n'a jamais pu relire.
          `updatePasswordAction` fait la comparaison côté serveur. */}
      <Field label="Confirmer le mot de passe" htmlFor="passwordConfirmation" hint="Retapez-le : c'est le seul champ qu'on ne peut pas relire.">
        <Input
          id="passwordConfirmation"
          name="passwordConfirmation"
          type="password"
          autoComplete="new-password"
          placeholder="Le même mot de passe"
        />
      </Field>

      {state?.error ? <p className="text-sm text-danger">{state.error}</p> : null}

      <Button type="submit" disabled={pending}>
        {pending ? "Enregistrement…" : "Enregistrer le mot de passe"}
      </Button>
    </form>
  );
}
