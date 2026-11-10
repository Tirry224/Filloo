import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { familleDe, type Famille } from "@/lib/mode";

export type CityOption = { id: number; name: string };

/** `famille` : le rayon (vêtements, chaussures, accessoires), voir `lib/mode.ts`. */
export type CategoryOption = { id: number; name: string; slug: string; famille: Famille };

export async function getCities(supabase: SupabaseClient<Database>): Promise<CityOption[]> {
  const { data, error } = await supabase.from("cities").select("id, name").order("position");
  if (error) throw error;
  return data;
}

/**
 * Les catégories PUBLIQUES, celles de la mode (0074). Les anciennes
 * (électronique, maison…) restent en base avec `visible = false` : ni
 * proposées au commerçant, ni montrées au client. L'équipe les voit
 * toutes dans `/admin` (`lireCatalogue`).
 */
export async function getCategories(supabase: SupabaseClient<Database>): Promise<CategoryOption[]> {
  const { data, error } = await supabase
    .from("categories")
    .select("id, name, slug, famille")
    .eq("visible", true)
    .order("position");
  if (error) throw error;
  return data.map((c) => ({ id: c.id, name: c.name, slug: c.slug, famille: familleDe(c.famille) }));
}
