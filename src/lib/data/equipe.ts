import { notFound } from "next/navigation";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { getSessionUser } from "@/lib/data/session";
import { estProprietaire } from "@/lib/proprietaire";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * La frontière de `/admin` : un membre de l'équipe (0042), sinon la page
 * n'existe pas — `notFound()` et non un refus, pour ne pas dire qu'il y
 * a ici quelque chose à forcer. Le RLS décide des lignes ; ceci décide
 * seulement quels écrans existent.
 *
 * Le compte du porteur du projet (`OWNER_EMAIL`, confirmé) n'a QUE
 * `/admin` : il est inscrit dans l'équipe à sa première visite, sinon il
 * tomberait sur une page introuvable sans aucune autre page où aller.
 */
export async function requireEquipe(supabase: SupabaseClient<Database>): Promise<User> {
  const user = await getSessionUser(supabase);
  if (!user) notFound();
  const { data, error } = await supabase.rpc("je_suis_de_l_equipe");
  if (error) throw error;
  if (data) return user;
  if (!estProprietaire(user)) notFound();

  // `service_role` : personne n'entre dans l'équipe par le RLS (0042).
  const { error: erreurInscription } = await createAdminClient()
    .from("equipe")
    .upsert({ auth_user_id: user.id, nom: "Porteur du projet" }, { onConflict: "auth_user_id", ignoreDuplicates: true });
  if (erreurInscription) throw erreurInscription;
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

export type FilBoite = {
  filDe: string;
  nom: string;
  dernierCorps: string;
  dernierAt: string;
  dernierDeLEquipe: boolean;
  nonLus: number;
};

/** La boîte de l'équipe (`boite_equipe`, 0042), le fil le plus récent d'abord. */
export async function lireBoite(supabase: SupabaseClient<Database>): Promise<FilBoite[]> {
  const { data, error } = await supabase.rpc("boite_equipe");
  if (error) throw error;
  return data.map((f) => ({
    filDe: f.fil_de,
    nom: f.nom,
    dernierCorps: f.dernier_corps,
    dernierAt: f.dernier_at,
    dernierDeLEquipe: f.dernier_de_l_equipe,
    nonLus: Number(f.non_lus),
  }));
}

/** La pastille de l'onglet Messages ; 0 en cas d'échec (une pastille ne bloque rien). */
export async function compterNonLusBoite(supabase: SupabaseClient<Database>): Promise<number> {
  try {
    return (await lireBoite(supabase)).reduce((total, f) => total + f.nonLus, 0);
  } catch {
    return 0;
  }
}

/** Le prénom affiché à un collègue (« Bonjour, … ») ; celui de la table `equipe`. */
export async function monNomDansLEquipe(supabase: SupabaseClient<Database>, authUserId: string): Promise<string | null> {
  const { data } = await supabase.from("equipe").select("nom").eq("auth_user_id", authUserId).maybeSingle();
  return data?.nom ?? null;
}
