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
 * La ville de DÉPART de la navigation : celle que le client a renseignée
 * dans son profil (`profiles.city_id`, 0010), sinon Conakry.
 *
 * Elle ne fixe qu'un point de départ, jamais un filtre permanent : dès que
 * `?ville=` est présent dans l'URL, c'est lui qui gagne. Le filtre de ville
 * reste MANUEL (docs/SPEC.md, décision 9) — cette fonction ne devine rien,
 * elle relit un choix déjà fait par la personne.
 *
 * Elle existe parce que le fil d'accueil appliquait cette règle et que
 * `/recherche` avait son propre "Conakry" en dur : un client de Boké
 * voyait son fil à Boké, touchait l'onglet « Rechercher », et se
 * retrouvait à Conakry sans avoir rien demandé. Deux écrans du même espace
 * ne peuvent pas répondre différemment à la même question.
 *
 * `cities` est passée en paramètre plutôt que relue ici : les deux écrans
 * qui s'en servent ont déjà la liste sous la main, et une requête gratuite
 * reste une requête.
 */
export async function getDefaultCityName(
  supabase: SupabaseClient<Database>,
  cities: CityOption[],
): Promise<string> {
  const profile = await getMyProfile(supabase, "client");
  return cities.find((c) => c.id === profile?.cityId)?.name ?? FALLBACK_CITY;
}
