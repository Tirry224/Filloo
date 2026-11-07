import { AbonnementsAdminVue } from "@/components/admin/AbonnementsAdminVue";
import { abonnementsEquipe, revenusAbonnements } from "@/lib/data/abonnements";
import { boutiquesEnLigne } from "@/lib/data/publicite";
import { createClient } from "@/lib/supabase/server";

/** Les abonnements à vérifier, actifs et passés, et ce qu'ils rapportent (0049). */
export default async function AbonnementsAdminPage({ searchParams }: { searchParams: Promise<{ erreur?: string; info?: string }> }) {
  const { erreur, info } = await searchParams;
  const supabase = await createClient();
  const [abonnements, revenus, boutiques] = await Promise.all([
    abonnementsEquipe(supabase),
    revenusAbonnements(supabase),
    boutiquesEnLigne(supabase),
  ]);
  return <AbonnementsAdminVue abonnements={abonnements} revenus={revenus} boutiques={boutiques} erreur={erreur} info={info} />;
}
