"use client";

import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { GoogleButton } from "@/components/auth/GoogleButton";
import { LONGUEUR_MIN_MOT_DE_PASSE } from "@/lib/password";
import { createMyPasswordAction } from "@/lib/actions/auth";
import { useFormulaire } from "@/lib/use-formulaire";
import { ErreurGenerale, ErreursFormulaire } from "@/components/ui/ErreurChamp";

/**
 * « Créer un mot de passe », pour un compte venu de Google. Il n'y a pas
 * de mot de passe actuel à demander : la preuve d'identité est une
 * connexion Google récente (`connexionGoogleRecente`). `googleRecent` ne
 * fait que choisir l'écran ; l'action serveur revérifie.
 */
export function CreatePasswordForm({
  googleRecent,
  retour,
  suite,
}: {
  googleRecent: boolean;
  retour: string;
  /** Sur la page OBLIGATOIRE : où reprendre une fois le mot de passe créé.
   *  Sa seule présence fait rediriger l'action au lieu d'afficher un
   *  message. */
  suite?: string;
}) {
  const { state, formAction, onSubmit, pending } = useFormulaire(createMyPasswordAction);
  const formulaire = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.sent) formulaire.current?.reset();
  }, [state]);

  if (!googleRecent) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-ink-soft">
          Vous vous connectez avec Google. Pour créer aussi un mot de passe, confirmez d&apos;abord que c&apos;est
          bien vous : vous aurez ensuite 10 minutes.
        </p>
        <GoogleButton label="Confirmer avec Google" next={retour} separateur={false} />
      </div>
    );
  }

  return (
    <ErreursFormulaire etat={state}>
      <form ref={formulaire} action={formAction} onSubmit={onSubmit} className="flex flex-col gap-4">
        {suite !== undefined ? <input type="hidden" name="suite" value={suite} /> : null}
        <p className="text-sm text-ink-soft">
          Vous pourrez ensuite vous connecter avec Google ou avec votre email et ce mot de passe.
        </p>

        <Field label="Mot de passe" htmlFor="newPassword">
          <PasswordInput
            id="newPassword"
            name="newPassword"
            autoComplete="new-password"
            placeholder={`${LONGUEUR_MIN_MOT_DE_PASSE} caractères, dont un chiffre`}
          />
        </Field>

        <Field
          label="Confirmer le mot de passe"
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

        <ErreurGenerale etat={state} />
        {state?.sent ? (
          <p className="text-sm font-semibold text-accent">
            Mot de passe créé. Vous pouvez maintenant vous connecter avec votre email.
          </p>
        ) : null}

        <Button type="submit" disabled={pending}>
          {pending ? "Enregistrement en cours" : "Créer mon mot de passe"}
        </Button>
      </form>
    </ErreursFormulaire>
  );
}
