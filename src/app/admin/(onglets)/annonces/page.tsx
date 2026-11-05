import { AnnoncesVue } from "@/components/admin/AnnoncesVue";
import { createClient } from "@/lib/supabase/server";

/** Les 20 dernières suffisent à suivre ce qui est parti ; le reste est au tableau de bord. */
const DERNIERES = 20;

/**
 * Publier une annonce, et voir qui l'a lue. Seules les personnes inscrites
 * au moment de la publication la reçoivent (décision du 2026-11-05).
 */
export default async function AnnoncesPage({ searchParams }: { searchParams: Promise<{ erreur?: string; info?: string }> }) {
  const { erreur, info } = await searchParams;
  const supabase = await createClient();
  const { data: annonces, error } = await supabase
    .from("annonces")
    .select("id, titre, corps, public, created_at, annonce_destinataires(lue_at)")
    .order("created_at", { ascending: false })
    .limit(DERNIERES);
  if (error) throw error;
  return <AnnoncesVue annonces={annonces} erreur={erreur} info={info} />;
}
