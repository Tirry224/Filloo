"use client";

import { Check } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { resendConfirmationAction } from "@/lib/actions/auth";
import { useFormulaire } from "@/lib/use-formulaire";

/** Sans `email`, l'adresse se saisit : c'est le cas d'un lien expiré. */
export function ResendConfirmationForm({ email }: { email?: string }) {
  const { state, formAction, onSubmit, pending } = useFormulaire(resendConfirmationAction);

  return (
    <form action={formAction} onSubmit={onSubmit} className="flex flex-col gap-2.5">
      {email ? (
        <input type="hidden" name="email" value={email} />
      ) : (
        <Field label="Email du compte" htmlFor="email-confirmation">
          <Input
            id="email-confirmation"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="Adresse e-mail"
          />
        </Field>
      )}

      <Button type="submit" variant="secondary" disabled={pending}>
        {pending ? "Envoi…" : "Renvoyer l'email de confirmation"}
      </Button>

      {state?.error ? <p className="text-sm text-danger">{state.error}</p> : null}
      {state?.sent ? (
        <p className="flex gap-2.5 rounded-lg bg-success-soft px-3.5 py-3 text-sm leading-normal text-success-ink">
          <Check size={19} strokeWidth={2.4} className="shrink-0 text-success" aria-hidden />
          Si un compte attend sa confirmation avec cet email, un nouveau lien vient de partir.
        </p>
      ) : null}
    </form>
  );
}
