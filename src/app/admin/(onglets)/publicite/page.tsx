import { PubliciteAdminVue } from "@/components/admin/PubliciteAdminVue";
import { lireRecherche } from "@/lib/data/gestion";
import { campagnesEquipe } from "@/lib/data/publicite";
import { createClient } from "@/lib/supabase/server";

/** Les campagnes des commerçants à valider, en cours et passées (0047). */
export default async function PubliciteAdminPage({ searchParams }: { searchParams: Promise<{ q?: string; erreur?: string; info?: string }> }) {
  const { q, erreur, info } = await searchParams;
  const supabase = await createClient();
  return <PubliciteAdminVue campagnes={await campagnesEquipe(supabase)} recherche={lireRecherche(q)} erreur={erreur} info={info} />;
}
