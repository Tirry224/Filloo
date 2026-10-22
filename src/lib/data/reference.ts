import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

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
