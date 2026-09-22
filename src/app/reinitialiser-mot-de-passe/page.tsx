import { redirect } from "next/navigation";
import { UpdatePasswordForm } from "@/components/auth/UpdatePasswordForm";
import { Screen, ScreenBody, Section } from "@/components/ui/Screen";
import { TopBar } from "@/components/ui/TopBar";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/data/session";
import { safeNextPath } from "@/lib/next-param";

/**
 * Page technique, absente de docs/ECRANS.md : atteinte uniquement via le
 * lien de /mot-de-passe-oublie, après l'échange de code par
 * /auth/confirm. Sans session "recovery" active, rien à faire ici.
 */
export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const suite = safeNextPath(next);
  const supabase = await createClient();
  const user = await getSessionUser(supabase);
  if (!user) redirect("/mot-de-passe-oublie?erreur=lien_invalide");

  return (
    <Screen>
      <TopBar title="Nouveau mot de passe" />
      <ScreenBody>
        <Section className="gap-4 py-6">
          <p className="text-base leading-relaxed text-ink-soft">
            Choisissez un nouveau mot de passe pour votre compte.
          </p>
          <UpdatePasswordForm next={suite ?? undefined} />
        </Section>
      </ScreenBody>
    </Screen>
  );
}
