import { AnnoncesVue } from "@/components/admin/AnnoncesVue";
import { lireAnnoncesAdmin } from "@/lib/data/equipe";
import { createClient } from "@/lib/supabase/server";

/** Les annonces de l'équipe (0045) : brouillons, programmées, publiées, retirées. */
export default async function AnnoncesPage({ searchParams }: { searchParams: Promise<{ erreur?: string; info?: string }> }) {
  const { erreur, info } = await searchParams;
  const supabase = await createClient();
  const annonces = await lireAnnoncesAdmin(supabase);
  return <AnnoncesVue annonces={annonces} erreur={erreur} info={info} />;
}
