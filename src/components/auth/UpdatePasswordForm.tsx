"use client";

import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { LONGUEUR_MIN_MOT_DE_PASSE } from "@/lib/password";
import { updatePasswordAction } from "@/lib/actions/auth";
import { useFormulaire } from "@/lib/use-formulaire";

export function UpdatePasswordForm({ next }: { next?: string }) {
  const { state, formAction, onSubmit, pending } = useFormulaire(updatePasswordAction);

  return (
    <form action={formAction} onSubmit={onSubmit} className="flex flex-col gap-4">
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <Field label="Nouveau mot de passe" htmlFor="password">
        <PasswordInput id="password" name="password" autoComplete="new-password" placeholder={`${LONGUEUR_MIN_MOT_DE_PASSE} caractères minimum`} />
      </Field>

      {/* `updatePasswordAction` fait la comparaison côté serveur. */}
      <Field label="Confirmer le mot de passe" htmlFor="passwordConfirmation" hint="Retapez-le, pour éviter une faute de frappe.">
        <PasswordInput
          id="passwordConfirmation"
          name="passwordConfirmation"
          autoComplete="new-password"
          placeholder="Confirmer le mot de passe"
        />
      </Field>

      {state?.error ? <p className="text-sm text-danger">{state.error}</p> : null}

      <Button type="submit" disabled={pending}>
        {pending ? "Enregistrement en cours" : "Enregistrer le mot de passe"}
      </Button>
    </form>
  );
}
