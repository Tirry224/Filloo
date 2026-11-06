import { HistoriqueVue } from "@/components/admin/HistoriqueVue";
import { lireJournal } from "@/lib/data/moderation";
import { createClient } from "@/lib/supabase/server";

/** Ce que l'équipe a fait, qui et quand (0046). Personne ne peut le modifier. */
export default async function HistoriquePage() {
  const supabase = await createClient();
  return <HistoriqueVue entrees={await lireJournal(supabase)} />;
}
