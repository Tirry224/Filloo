import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";
import { Screen, ScreenBody, Section } from "@/components/ui/Screen";
import { TopBar } from "@/components/ui/TopBar";

/**
 * Mot de passe oublié — écran 15 de docs/ECRANS.md.
 *
 * `?erreur=lien_invalide` est posé par `/auth/confirm` (échange du jeton
 * échoué) et par `/reinitialiser-mot-de-passe` (aucune session de
 * récupération). Cet écran doit le LIRE : muet, il réaffichait le
 * formulaire à l'identique, sans distinguer un lien expiré d'une erreur de
 * saisie, et la personne redemandait un lien — chaque demande frappant la
 * limite d'envoi du serveur mail de Supabase (docs/REPRISE.md, étape 2).
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
