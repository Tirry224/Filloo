import { CatalogueVue } from "@/components/admin/GestionVue";
import { lireCatalogue } from "@/lib/data/gestion";
import { createClient } from "@/lib/supabase/server";

/** Catégories et villes du catalogue (0066). */
export default async function CataloguePage({ searchParams }: { searchParams: Promise<{ erreur?: string; info?: string }> }) {
  const { erreur, info } = await searchParams;
  const supabase = await createClient();
  const { categories, villes } = await lireCatalogue(supabase);
  return <CatalogueVue categories={categories} villes={villes} erreur={erreur} info={info} />;
}
