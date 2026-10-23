import { redirect } from "next/navigation";
import { Screen, ScreenBody, Section } from "@/components/ui/Screen";
import { TopBar } from "@/components/ui/TopBar";
import { SignupForm } from "@/components/auth/SignupForm";
import { createClient } from "@/lib/supabase/server";
import { getMyDeletedRoles, getMyProfiles } from "@/lib/data/session";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { UserX } from "lucide-react";
import { safeNextPath } from "@/lib/next-param";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const next = safeNextPath((await searchParams).next) ?? undefined;
  const supabase = await createClient();
  const [profiles, supprimes] = await Promise.all([getMyProfiles(supabase), getMyDeletedRoles(supabase)]);

  if (profiles.length >= 2) redirect("/compte");

  const mode = profiles.length > 0 ? "linked" : "new";
  const existing = profiles[0];

  /* Le second compte est celui que cette connexion a SUPPRIMÉ : il ne se
     recrée pas (`profiles` est unique par connexion et par rôle, et la
     ligne anonymisée reste, citée par les messages). Le dire ici plutôt
     que laisser l'envoi échouer sur « vous avez déjà ce compte ». */
  const manquant = existing?.role === "merchant" ? "client" : "merchant";
  if (existing && supprimes.includes(manquant)) {
    return (
      <Screen>
        <TopBar title="Créer un compte" backHref={existing.role === "merchant" ? "/vendeur/boutique" : "/compte"} />
        <ScreenBody>
          <EmptyState
            icon={UserX}
            title={manquant === "client" ? "Compte client supprimé" : "Boutique supprimée"}
            description="Un compte supprimé ne peut pas être recréé avec cette adresse email. Pour en ouvrir un nouveau, inscrivez-vous avec une autre adresse."
          >
            <Button variant="secondary" href={existing.role === "merchant" ? "/vendeur/boutique" : "/compte"}>
              Retour
            </Button>
          </EmptyState>
        </ScreenBody>
      </Screen>
    );
  }

  return (
    <Screen>
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
