import { TarifsPubliciteVue } from "@/components/admin/TarifsPubliciteVue";
import { lireTarifsAbonnement } from "@/lib/data/abonnements";
import { lireMoyensPaiement, lireTarifs } from "@/lib/data/publicite";
import { createClient } from "@/lib/supabase/server";

/** Les prix de la publicité et les numéros de paiement (0048). Garde : `admin/layout.tsx`. */
export default async function TarifsPage({ searchParams }: { searchParams: Promise<{ erreur?: string; info?: string }> }) {
  const { erreur, info } = await searchParams;
  const supabase = await createClient();
  const [tarifs, tarifsAbonnement, moyens] = await Promise.all([
    lireTarifs(supabase),
    lireTarifsAbonnement(supabase),
    lireMoyensPaiement(supabase),
  ]);
  return <TarifsPubliciteVue tarifs={tarifs} tarifsAbonnement={tarifsAbonnement} moyens={moyens} erreur={erreur} info={info} />;
}
