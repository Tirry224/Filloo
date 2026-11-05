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

export type EspaceEquipe = Database["public"]["Enums"]["user_role"];

/** Un espace lu dans une URL ou un formulaire : « merchant », sinon « client ». */
export function lireEspace(valeur: unknown): EspaceEquipe {
  return valeur === "merchant" ? "merchant" : "client";
}

/** Les publics d'annonce qu'un espace lit (0044) : « tous » partout, puis le sien. */
export const PUBLICS_DE = {
  client: ["tous", "clients"],
  merchant: ["tous", "commercants"],
} as const satisfies Record<EspaceEquipe, readonly Database["public"]["Enums"]["public_annonce"][]>;

/** La page « Équipe Filloo » de chaque espace. */
export const CHEMINS_EQUIPE = {
  client: "/compte/equipe",
  merchant: "/vendeur/equipe",
} as const satisfies Record<"client" | "merchant", string>;

/** Annonces et réponses de l'équipe que je n'ai pas lues ; 0 en cas d'échec (une pastille ne bloque rien). */
export async function compterNonLusEquipe(
  supabase: SupabaseClient<Database>,
  authUserId: string,
  espace: EspaceEquipe,
): Promise<number> {
  const [annonces, reponses] = await Promise.all([
    supabase
      .from("annonce_destinataires")
      .select("annonce_id, annonces!inner(public)", { count: "exact", head: true })
      .eq("auth_user_id", authUserId)
      .in("annonces.public", [...PUBLICS_DE[espace]])
      .is("lue_at", null),
    supabase
      .from("fil_equipe")
      .select("id", { count: "exact", head: true })
      .eq("fil_de", authUserId)
      .eq("espace", espace)
      .eq("de_l_equipe", true)
      .is("lu_at", null),
  ]);
  return (annonces.count ?? 0) + (reponses.count ?? 0);
}

export type FilBoite = {
  filDe: string;
  espace: EspaceEquipe;
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
    espace: f.espace,
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

/** Une ligne de l'onglet « Notifications » : ce que Filloo m'a envoyé (décision du 2026-11-05). */
export type NotificationEquipe =
  | { type: "annonce"; id: string; titre: string; texte: string; quand: string; nonLue: boolean }
  | { type: "reponse"; id: string; texte: string; quand: string; nonLue: boolean };

/**
 * Les annonces de cet espace et chaque réponse de l'équipe, la plus
 * récente d'abord. Rien de nouveau en base : les deux y sont déjà. Les
 * messages entre clients et boutiques n'y sont pas : ils ont leur onglet.
 */
export async function lireNotificationsEquipe(
  supabase: SupabaseClient<Database>,
  authUserId: string,
  espace: EspaceEquipe,
): Promise<NotificationEquipe[]> {
  const [annonces, reponses] = await Promise.all([
    supabase
      .from("annonces")
      .select("id, titre, corps, created_at, annonce_destinataires(lue_at, auth_user_id)")
      .in("public", [...PUBLICS_DE[espace]])
      .eq("annonce_destinataires.auth_user_id", authUserId)
      .order("created_at", { ascending: false }),
    supabase
      .from("fil_equipe")
      .select("id, corps, created_at, lu_at")
      .eq("fil_de", authUserId)
      .eq("espace", espace)
      .eq("de_l_equipe", true)
      .order("created_at", { ascending: false }),
  ]);
  if (annonces.error) throw annonces.error;
  if (reponses.error) throw reponses.error;

  const elements: NotificationEquipe[] = [
    ...annonces.data.map((a) => ({
      type: "annonce" as const,
      id: a.id,
      titre: a.titre,
      texte: a.corps,
      quand: a.created_at,
      nonLue: a.annonce_destinataires.some((d) => d.lue_at === null),
    })),
    ...reponses.data.map((r) => ({
      type: "reponse" as const,
      id: r.id,
      texte: r.corps,
      quand: r.created_at,
      nonLue: r.lu_at === null,
    })),
  ];
  return elements.sort((a, b) => b.quand.localeCompare(a.quand));
}

/** Une annonce de cet espace, à lire (le RLS ne rend que les miennes). */
export async function lireAnnonceEquipe(
  supabase: SupabaseClient<Database>,
  id: string,
  espace: EspaceEquipe,
): Promise<{ titre: string; texte: string; quand: string } | null> {
  const { data, error } = await supabase
    .from("annonces")
    .select("titre, corps, created_at")
    .eq("id", id)
    .in("public", [...PUBLICS_DE[espace]])
    .maybeSingle();
  if (error) throw error;
  return data ? { titre: data.titre, texte: data.corps, quand: data.created_at } : null;
}

export type MessageEchange = { id: string; deLEquipe: boolean; texte: string; quand: string };

/**
 * Une réponse de l'équipe, avec ce qui l'entoure dans le même fil
 * (décision du 2026-11-05) : la QUESTION (mes messages depuis la réponse
 * précédente de l'équipe), la RÉPONSE, puis la SUITE (ce que j'ai écrit
 * après, jusqu'à la réponse suivante de l'équipe, qui a sa propre page).
 * `null` si ce n'est pas une réponse de l'équipe dans mon fil de cet espace.
 */
export async function lireEchangeEquipe(
  supabase: SupabaseClient<Database>,
  authUserId: string,
  espace: EspaceEquipe,
  reponseId: string,
): Promise<{ question: MessageEchange[]; reponse: MessageEchange; suite: MessageEchange[] } | null> {
  const { data, error } = await supabase
    .from("fil_equipe")
    .select("id, de_l_equipe, corps, created_at")
    .eq("fil_de", authUserId)
    .eq("espace", espace)
    .order("created_at");
  if (error) throw error;
  const fil = data.map((m) => ({ id: m.id, deLEquipe: m.de_l_equipe, texte: m.corps, quand: m.created_at }));
  const i = fil.findIndex((m) => m.id === reponseId);
  const reponse = fil[i];
  if (!reponse || !reponse.deLEquipe) return null;

  let debut = i;
  while (debut > 0 && !fil[debut - 1]!.deLEquipe) debut--;
  let fin = i + 1;
  while (fin < fil.length && !fil[fin]!.deLEquipe) fin++;
  return { question: fil.slice(debut, i), reponse, suite: fil.slice(i + 1, fin) };
}
