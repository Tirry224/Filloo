import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";
import { Screen, ScreenBody, Section } from "@/components/ui/Screen";
import { TopBar } from "@/components/ui/TopBar";

/**
 * Mot de passe oublié — écran 15 de docs/ECRANS.md.
 *
 * `?erreur=lien_invalide` est posé par deux endroits — `/auth/confirm`
 * quand l'échange du jeton échoue, et `/reinitialiser-mot-de-passe` quand
 * aucune session de récupération n'est active — mais cet écran ne le
 * lisait pas. Quelqu'un qui cliquait sur un lien reçu la veille retombait
 * donc sur le formulaire de départ, mot pour mot identique, sans un mot
 * d'explication : il ne pouvait pas distinguer « le lien a expiré » de
 * « je me suis trompé d'adresse » ou de « l'application est cassée ».
 *
 * Le coût n'est pas seulement de la confusion : il redemande un lien, et
 * chaque demande frappe la limite d'envoi du serveur mail intégré de
 * Supabase (étape 2 de docs/REPRISE.md). Un écran muet fabrique le
 * problème qu'il devrait éviter.
 */
export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ erreur?: string }>;
}) {
  const { erreur } = await searchParams;

  return (
    <Screen>
      <TopBar title="Mot de passe oublié" backHref="/connexion" />
      <ScreenBody>
        <Section className="gap-4 py-6">
          {erreur === "lien_invalide" ? (
            <p className="rounded-lg bg-warn-soft px-3.5 py-3 text-sm leading-normal text-warn-ink">
              Ce lien n&apos;est plus valable — les liens expirent au bout d&apos;une heure,
              et ne servent qu&apos;une fois. Demandez-en un nouveau ci-dessous.
            </p>
          ) : null}

          <p className="text-base leading-relaxed text-ink-soft">
            Entrez l&apos;email de votre compte. Vous recevrez un lien pour choisir un
            nouveau mot de passe.
          </p>

          <ForgotPasswordForm />
        </Section>
      </ScreenBody>
    </Screen>
  );
}
