import { PubliciteAdminVue } from "@/components/admin/PubliciteAdminVue";
import { campagnesEquipe, revenusPublicite } from "@/lib/data/publicite";
import { createClient } from "@/lib/supabase/server";

/** Les campagnes à vérifier, à rembourser, en ligne et passées, et ce qu'elles ont rapporté (0047, 0048). */
export default async function PubliciteAdminPage({ searchParams }: { searchParams: Promise<{ erreur?: string; info?: string }> }) {
  const { erreur, info } = await searchParams;
  const supabase = await createClient();
  const [campagnes, revenus] = await Promise.all([campagnesEquipe(supabase), revenusPublicite(supabase)]);
  return <PubliciteAdminVue campagnes={campagnes} revenus={revenus} erreur={erreur} info={info} />;
}
