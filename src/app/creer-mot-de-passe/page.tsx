import { redirect } from "next/navigation";
import { CreatePasswordForm } from "@/components/auth/CreatePasswordForm";
import { Screen, ScreenBody, Section } from "@/components/ui/Screen";
import { TopBar } from "@/components/ui/TopBar";
import { createClient } from "@/lib/supabase/server";
import { connexionGoogleDeMoinsDeDixMinutes, getSessionUser } from "@/lib/data/session";
import { destinationApresAuthentification } from "@/lib/destination";
import { safeNextPath } from "@/lib/next-param";
import { aUnMotDePasse, CHEMIN_CREER_MOT_DE_PASSE } from "@/lib/password";

/**
 * Créer son mot de passe, OBLIGATOIRE pour un compte venu de Google
 * (décision du porteur du projet, 2026-11-13) : le middleware renvoie ici
 * tant qu'il n'y en a pas. Une seule fois ; ensuite, Google suffit pour se
 * connecter.
 */
export default async function CreerMotDePassePage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const suite = safeNextPath(next) ?? "";
  const supabase = await createClient();
  const user = await getSessionUser(supabase);
  if (!user) redirect("/connexion");
  if (aUnMotDePasse(user)) redirect(await destinationApresAuthentification(supabase, suite));

  const googleRecent = await connexionGoogleDeMoinsDeDixMinutes(supabase);
  const ici = suite ? `${CHEMIN_CREER_MOT_DE_PASSE}?next=${encodeURIComponent(suite)}` : CHEMIN_CREER_MOT_DE_PASSE;

  return (
    <Screen>
      <TopBar title="Créez votre mot de passe" />
      <ScreenBody>
        <Section className="gap-4 py-6">
          <p className="text-base leading-relaxed text-ink-soft">
            Une dernière étape : tous les comptes Filloo ont un mot de passe. Il vous servira à confirmer les
            changements importants, et à vous connecter si Google ne marche pas.
          </p>
          <CreatePasswordForm googleRecent={googleRecent} retour={ici} suite={suite} />
        </Section>
      </ScreenBody>
    </Screen>
  );
}
