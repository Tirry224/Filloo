import { redirect } from "next/navigation";
import { Screen, ScreenBody, Section } from "@/components/ui/Screen";
import { TopBar } from "@/components/ui/TopBar";
import { SignupForm } from "@/components/auth/SignupForm";
import { createClient } from "@/lib/supabase/server";
import { getMyProfiles } from "@/lib/data/session";
import { safeNextPath } from "@/lib/next-param";

/** Inscription — écran 12 de docs/ECRANS.md. `?next=` : voir
 * `safeNextPath` et l'écran 16, d'où l'on arrive le plus souvent. */
export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const next = safeNextPath((await searchParams).next) ?? undefined;
  const supabase = await createClient();
  const profiles = await getMyProfiles(supabase);

  // Déjà les deux comptes liés : rien à créer de plus ici.
  if (profiles.length >= 2) redirect("/compte");

  const mode = profiles.length > 0 ? "linked" : "new";
  const existing = profiles[0];

  return (
    <Screen>
      {/* Le retour ramène là d'où l'on vient (la fiche produit, presque
          toujours) plutôt qu'au fil d'accueil : renoncer à créer un compte
          ne doit pas non plus faire perdre le produit. */}
      <TopBar title="Créer un compte" backHref={next ?? "/"} />

      <ScreenBody>
        <Section className="gap-4">
          <SignupForm
            mode={mode}
            excludeRole={existing?.role}
            defaultFullName={existing?.fullName}
            defaultPhone={existing?.phone}
            next={next}
          />
        </Section>
      </ScreenBody>
    </Screen>
  );
}
