import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { getMyProfile } from "@/lib/data/session";

export type CityOption = { id: number; name: string };
export type CategoryOption = { id: number; name: string };

/** Les 12 villes de 0003_search_and_seed.sql, dans l'ordre d'affichage voulu. */
export async function getCities(supabase: SupabaseClient<Database>): Promise<CityOption[]> {
  const { data, error } = await supabase.from("cities").select("id, name").order("position");
  if (error) throw error;
  return data;
}

/** Les 10 catégories de 0003_search_and_seed.sql. */
export async function getCategories(supabase: SupabaseClient<Database>): Promise<CategoryOption[]> {
  const { data, error } = await supabase.from("categories").select("id, name").order("position");
  if (error) throw error;
  return data;
}

/** Le repli quand rien d'autre ne dit où l'on est : Makiti démarre à
 * Conakry, et c'est la seule ville qu'on peut supposer non vide. */
export const FALLBACK_CITY = "Conakry";

/**
 * La ville de DÉPART de la navigation : celle du profil client
 * (`profiles.city_id`, 0010), sinon Conakry. Un point de départ, jamais un
 * filtre permanent — dès que `?ville=` est dans l'URL, c'est lui qui gagne,
 * et le filtre reste MANUEL (docs/SPEC.md, décision 9) : on ne devine rien,
 * on relit un choix déjà fait.
 *
 * Écrite une fois parce que `/recherche` avait son propre "Conakry" en dur :
 * un client de Boké voyait son fil à Boké puis retombait à Conakry en
 * touchant « Rechercher ». `cities` est passée en paramètre, les deux écrans
 * qui s'en servent l'ayant déjà sous la main.
 */
export async function getDefaultCityName(
  supabase: SupabaseClient<Database>,
  cities: CityOption[],
): Promise<string> {
  const profile = await getMyProfile(supabase, "client");
  return cities.find((c) => c.id === profile?.cityId)?.name ?? FALLBACK_CITY;
}
