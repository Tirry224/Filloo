import { redirect } from "next/navigation";
import { Flag } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Screen, ScreenBody, Section } from "@/components/ui/Screen";
import { SwitchSpaceCard } from "@/components/ui/SwitchSpaceCard";
import { TopBar, Wordmark } from "@/components/ui/TopBar";
import { createClient } from "@/lib/supabase/server";
import { clientSpaceFallback, getMyProfiles, landingForSession } from "@/lib/data/session";

export default async function SuspendedPage() {
  const supabase = await createClient();

  // Recherche par SUSPENSION et non par rôle : elle vit sur `profiles`,
  // donc frappe un commerçant pareil. Chercher un profil client renverrait
  // un commerçant suspendu vers son espace, qui le renverrait ici.
  const profiles = await getMyProfiles(supabase);
  const suspended = profiles.find((p) => p.isSuspended && !p.isDeleted);
  if (profiles.length === 0) redirect(await clientSpaceFallback(supabase));
  if (!suspended) redirect(await landingForSession(supabase));

  /* espaces:autorise — la suspension frappe un PROFIL, pas la connexion :
     qui garde un espace actif doit pouvoir le rejoindre. Geste de bascule
     comme `SwitchSpaceCard`, pas une redirection subie. */
  const stillActive = profiles.find((p) => !p.isSuspended && !p.isDeleted);

  return (
    <Screen>
      <TopBar title={<Wordmark />} />
      <ScreenBody>
        <EmptyState
          icon={Flag}
          title="Votre compte est suspendu"
          description={
            suspended.role === "merchant"
              ? "Vous pouvez encore consulter le catalogue, mais pas publier de produit ni répondre à vos clients."
              : "Vous pouvez encore consulter le catalogue, mais pas envoyer de messages."
          }
        >
          <Button variant="secondary" href="/">
            Voir les produits
          </Button>
        </EmptyState>
        {stillActive ? (
          <Section className="pt-0">
            <SwitchSpaceCard
              label={
                stillActive.role === "merchant"
                  ? "Basculer vers mon espace commerçant"
                  : "Basculer vers mon espace client"
              }
              target={
                stillActive.role === "merchant"
                  ? "Cette suspension ne touche pas votre boutique."
                  : "Cette suspension ne touche pas votre compte client."
              }
              href={stillActive.role === "merchant" ? "/vendeur" : "/compte"}
            />
          </Section>
        ) : null}
        <Section className="pt-0">
          <p className="rounded-lg bg-warn-soft px-3.5 py-3 text-sm leading-normal text-warn-ink">
            Si vous pensez qu&apos;il s&apos;agit d&apos;une erreur, écrivez-nous en expliquant la
            situation. Nous répondons sous 72 heures.
          </p>
        </Section>
      </ScreenBody>
    </Screen>
  );
}
