"use client";

import { useActionState } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { requestPasswordResetAction, type ActionState } from "@/lib/actions/auth";
import { garderLaSaisie } from "@/lib/garder-la-saisie";

export function ForgotPasswordForm({ next }: { next?: string }) {
  const [state, formAction, pending] = useActionState<ActionState | null, FormData>(requestPasswordResetAction, null);

  return (
    <form action={formAction} onSubmit={garderLaSaisie(formAction)} className="flex flex-col gap-4">
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <Field label="Email" htmlFor="email">
        <Input id="email" name="email" type="email" inputMode="email" autoComplete="email" placeholder="mariama@exemple.com" />
      </Field>

      <Button type="submit" disabled={pending}>
        {pending ? "Envoi…" : "Envoyer le lien"}
      </Button>

      {/* Le message ne dit jamais si le compte existe : sinon n'importe
          qui pourrait tester des adresses une par une pour découvrir qui
          est inscrit sur Filloo. */}
      {state?.sent ? (
        <p className="flex gap-2.5 rounded-lg bg-success-soft px-3.5 py-3 text-sm leading-normal text-success-ink">
          <Check size={19} strokeWidth={2.4} className="shrink-0 text-success" aria-hidden />
          Si un compte existe avec cet email, le lien a été envoyé. Pensez à regarder
          dans les courriers indésirables.
        </p>
      ) : null}
    </form>
  );
}
