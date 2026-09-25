"use client";

import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { updatePasswordAction } from "@/lib/actions/auth";
import { useFormulaire } from "@/lib/use-formulaire";

export function UpdatePasswordForm({ next }: { next?: string }) {
  const { state, formAction, onSubmit, pending } = useFormulaire(updatePasswordAction);

  return (
    <form action={formAction} onSubmit={onSubmit} className="flex flex-col gap-4">
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <Field label="Nouveau mot de passe" htmlFor="password">
        <Input id="password" name="password" type="password" autoComplete="new-password" placeholder="8 caractères minimum" />
      </Field>

      {/* `updatePasswordAction` fait la comparaison côté serveur. */}
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
