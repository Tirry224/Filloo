import { CreditsVue } from "@/components/credits/CreditsVue";
import { mesAchatsCredits, mesCredits, mesLotsCredits } from "@/lib/data/credits";
import { lireMoyensPaiement } from "@/lib/data/publicite";
import { createClient } from "@/lib/supabase/server";

/** « Mes crédits » (0060). Garde héritée de `(vendeur)/layout.tsx`. */
export default async function CreditsPage({ searchParams }: { searchParams: Promise<{ erreur?: string; info?: string }> }) {
  const { erreur, info } = await searchParams;
  const supabase = await createClient();
  const [solde, lots, achats, moyens] = await Promise.all([
    mesCredits(supabase),
    mesLotsCredits(supabase),
    mesAchatsCredits(supabase),
    lireMoyensPaiement(supabase),
  ]);
  return <CreditsVue solde={solde} lots={lots} achats={achats} moyens={moyens} erreur={erreur} info={info} />;
}
