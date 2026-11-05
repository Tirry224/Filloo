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

/** La page « Équipe Filloo » de chaque espace. */
export const CHEMINS_EQUIPE = {
  client: "/compte/equipe",
  merchant: "/vendeur/equipe",
} as const satisfies Record<"client" | "merchant", string>;

export type ElementEquipe =
  | { type: "annonce"; id: string; titre: string; texte: string; quand: string }
  | { type: "message"; id: string; deLEquipe: boolean; texte: string; quand: string; enReponseA: string | null };

/**
 * Mes annonces et mon fil avec l'équipe, du plus ancien au plus récent.
 * Le RLS fait le tri (0042) : aucun filtre ici n'est une protection.
 */
export async function lireMonFilEquipe(supabase: SupabaseClient<Database>, authUserId: string): Promise<ElementEquipe[]> {
  const [annonces, messages] = await Promise.all([
    supabase.from("annonces").select("id, titre, corps, created_at").order("created_at"),
    supabase
      .from("fil_equipe")
      .select("id, de_l_equipe, corps, created_at, annonces(titre)")
      .eq("fil_de", authUserId)
      .order("created_at"),
  ]);
  if (annonces.error) throw annonces.error;
  if (messages.error) throw messages.error;

  const elements: ElementEquipe[] = [
    ...annonces.data.map((a) => ({ type: "annonce" as const, id: a.id, titre: a.titre, texte: a.corps, quand: a.created_at })),
    ...messages.data.map((m) => ({
      type: "message" as const,
      id: m.id,
      deLEquipe: m.de_l_equipe,
      texte: m.corps,
      quand: m.created_at,
      enReponseA: m.annonces?.titre ?? null,
    })),
  ];
  return elements.sort((a, b) => a.quand.localeCompare(b.quand));
}

/** Annonces et réponses de l'équipe que je n'ai pas lues ; 0 en cas d'échec (une pastille ne bloque rien). */
export async function compterNonLusEquipe(supabase: SupabaseClient<Database>, authUserId: string): Promise<number> {
  const [annonces, reponses] = await Promise.all([
    supabase
      .from("annonce_destinataires")
      .select("annonce_id", { count: "exact", head: true })
      .eq("auth_user_id", authUserId)
      .is("lue_at", null),
    supabase
      .from("fil_equipe")
      .select("id", { count: "exact", head: true })
      .eq("fil_de", authUserId)
      .eq("de_l_equipe", true)
      .is("lu_at", null),
  ]);
  return (annonces.count ?? 0) + (reponses.count ?? 0);
}
