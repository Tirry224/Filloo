import { notFound } from "next/navigation";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { getSessionUser } from "@/lib/data/session";

/**
 * La frontière de `/admin` : un membre de l'équipe (0042), sinon la page
 * n'existe pas — `notFound()` et non un refus, comme `/suivi`, pour ne pas
 * dire qu'il y a ici quelque chose à forcer. Le RLS décide des lignes ;
 * ceci décide seulement quels écrans existent.
 */
export async function requireEquipe(supabase: SupabaseClient<Database>): Promise<User> {
  const user = await getSessionUser(supabase);
  if (!user) notFound();
  const { data, error } = await supabase.rpc("je_suis_de_l_equipe");
  if (error) throw error;
  if (!data) notFound();
  return user;
}

export const PUBLICS = {
  tous: "Tout le monde",
  clients: "Les clients",
  commercants: "Les commerçants",
} as const satisfies Record<Database["public"]["Enums"]["public_annonce"], string>;
