import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { getMyProfile } from "@/lib/data/session";

export type CityOption = { id: number; name: string };
export type CategoryOption = { id: number; name: string };

export async function getCities(supabase: SupabaseClient<Database>): Promise<CityOption[]> {
  const { data, error } = await supabase.from("cities").select("id, name").order("position");
  if (error) throw error;
  return data;
}

export async function getCategories(supabase: SupabaseClient<Database>): Promise<CategoryOption[]> {
  const { data, error } = await supabase.from("categories").select("id, name").order("position");
  if (error) throw error;
  return data;
}

export const FALLBACK_CITY = "Conakry";

export async function getDefaultCityName(
  supabase: SupabaseClient<Database>,
  cities: CityOption[],
): Promise<string> {
  const profile = await getMyProfile(supabase, "client");
  return cities.find((c) => c.id === profile?.cityId)?.name ?? FALLBACK_CITY;
}
