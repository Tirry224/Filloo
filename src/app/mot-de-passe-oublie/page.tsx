import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";
import { Screen, ScreenBody, Section } from "@/components/ui/Screen";
import { TopBar } from "@/components/ui/TopBar";
import { safeNextPath } from "@/lib/next-param";

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ erreur?: string; next?: string }>;
}) {
  const { erreur, next } = await searchParams;
  const suite = safeNextPath(next);

  return (
    <Screen>
      <TopBar
        title="Mot de passe oublié"
        backHref={suite ? `/connexion?next=${encodeURIComponent(suite)}` : "/connexion"}
      />
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

          <ForgotPasswordForm next={suite ?? undefined} />
        </Section>
      </ScreenBody>
    </Screen>
  );
}
