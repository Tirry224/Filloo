import { CreditsAdminVue } from "@/components/admin/CreditsAdminVue";
import { achatsCreditsEquipe, revenusCredits, soldesEquipe } from "@/lib/data/credits";
import { boutiquesEnLigne } from "@/lib/data/publicite";
import { createClient } from "@/lib/supabase/server";

/** Les achats de crédits, les soldes et les corrections de l'équipe (0050). */
export default async function CreditsAdminPage({ searchParams }: { searchParams: Promise<{ erreur?: string; info?: string }> }) {
  const { erreur, info } = await searchParams;
  const supabase = await createClient();
  const [achats, soldes, revenus, boutiques] = await Promise.all([
    achatsCreditsEquipe(supabase),
    soldesEquipe(supabase),
    revenusCredits(supabase),
    boutiquesEnLigne(supabase),
  ]);
  return <CreditsAdminVue achats={achats} soldes={soldes} revenus={revenus} boutiques={boutiques} erreur={erreur} info={info} />;
}
