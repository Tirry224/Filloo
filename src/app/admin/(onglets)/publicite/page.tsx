import { PubliciteAdminVue } from "@/components/admin/PubliciteAdminVue";
import { campagnesEquipe } from "@/lib/data/publicite";
import { createClient } from "@/lib/supabase/server";

/** Les campagnes des commerçants à valider, en cours et passées (0047). */
export default async function PubliciteAdminPage({ searchParams }: { searchParams: Promise<{ erreur?: string; info?: string }> }) {
  const { erreur, info } = await searchParams;
  const supabase = await createClient();
  return <PubliciteAdminVue campagnes={await campagnesEquipe(supabase)} erreur={erreur} info={info} />;
}
