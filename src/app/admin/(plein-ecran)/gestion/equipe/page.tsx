import { EquipeVue } from "@/components/admin/GestionVue";
import { lireMembres } from "@/lib/data/gestion";
import { createClient } from "@/lib/supabase/server";

/** Les membres de l'équipe : ajouter, retirer (0065). */
export default async function EquipePage({ searchParams }: { searchParams: Promise<{ erreur?: string; info?: string }> }) {
  const { erreur, info } = await searchParams;
  const supabase = await createClient();
  return <EquipeVue membres={await lireMembres(supabase)} erreur={erreur} info={info} />;
}
