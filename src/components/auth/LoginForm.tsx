"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { signInAction, type ActionState } from "@/lib/actions/auth";

/** Connexion — écran 14. `next` porte l'écran à rejoindre une fois
 * connecté : on n'arrive presque jamais ici pour le plaisir de se
 * connecter, mais parce qu'un geste a été interrompu. */
export function LoginForm({ next }: { next?: string }) {
  const [state, formAction, pending] = useActionState<ActionState | null, FormData>(signInAction, null);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <Field label="Email" htmlFor="email">
        <Input id="email" name="email" type="email" inputMode="email" autoComplete="email" placeholder="mariama@exemple.com" />
      </Field>

      <Field label="Mot de passe" htmlFor="password">
        <Input id="password" name="password" type="password" autoComplete="current-password" placeholder="••••••••" />
      </Field>

      <Link href="/mot-de-passe-oublie" className="-mt-1 self-end text-sm font-semibold text-accent">
        Mot de passe oublié ?
      </Link>

      {state?.error ? <p className="text-sm text-danger">{state.error}</p> : null}

      <Button type="submit" disabled={pending}>
        {pending ? "Connexion…" : "Se connecter"}
      </Button>
      <Button variant="secondary" href={next ? `/inscription?next=${encodeURIComponent(next)}` : "/inscription"}>
        Créer un compte
      </Button>
    </form>
  );
}
