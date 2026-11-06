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

/** Une ligne d'Équipe Filloo : une annonce, ou LA discussion avec l'équipe. */
export type NotificationEquipe =
  | { type: "annonce"; id: string; titre: string; texte: string; quand: string; nonLue: boolean; modifiee: boolean }
  | {
      type: "discussion";
      /** Le dernier message, et qui l'a écrit. */
      texte: string;
      deLEquipe: boolean;
      quand: string;
      /** Une réponse de l'équipe que je n'ai pas lue. */
      nonLue: boolean;
    };

/**
 * Ce qu'affiche Équipe Filloo (décision du 2026-11-05) : la discussion
 * avec l'équipe — UNE par espace, tous les messages ensemble, qu'ils
 * viennent du bouton « Écrire » ou d'une réponse —, puis les annonces de
 * cet espace, la plus récente d'abord. Les messages entre clients et
 * boutiques n'y sont pas : ils ont leur onglet.
 */
export async function lireNotificationsEquipe(
  supabase: SupabaseClient<Database>,
  authUserId: string,
  espace: EspaceEquipe,
): Promise<NotificationEquipe[]> {
  const [annonces, dernier, nonLues] = await Promise.all([
    supabase
      .from("annonces")
      .select("id, titre, corps, publiee_at, created_at, modifiee_at, annonce_destinataires(lue_at, auth_user_id)")
      .in("public", [...PUBLICS_DE[espace]])
      .eq("etat", "publiee")
      .eq("annonce_destinataires.auth_user_id", authUserId)
      .order("publiee_at", { ascending: false }),
    supabase
      .from("fil_equipe")
      .select("corps, de_l_equipe, created_at")
      .eq("fil_de", authUserId)
      .eq("espace", espace)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("fil_equipe")
      .select("id", { count: "exact", head: true })
      .eq("fil_de", authUserId)
      .eq("espace", espace)
      .eq("de_l_equipe", true)
      .is("lu_at", null),
  ]);
  if (annonces.error) throw annonces.error;
  if (dernier.error) throw dernier.error;

  const elements: NotificationEquipe[] = [];
  if (dernier.data) {
    elements.push({
      type: "discussion",
      texte: dernier.data.corps,
      deLEquipe: dernier.data.de_l_equipe,
      quand: dernier.data.created_at,
      nonLue: (nonLues.count ?? 0) > 0,
    });
  }
  for (const a of annonces.data) {
    elements.push({
      type: "annonce",
      id: a.id,
      titre: a.titre,
      texte: a.corps,
      // La date de publication : une annonce programmée a été créée avant.
      quand: a.publiee_at ?? a.created_at,
      nonLue: a.annonce_destinataires.some((d) => d.lue_at === null),
      modifiee: a.modifiee_at !== null,
    });
  }
  return elements;
}

/** Une annonce de cet espace, à lire (le RLS ne rend que les miennes). */
export async function lireAnnonceEquipe(
  supabase: SupabaseClient<Database>,
  id: string,
  espace: EspaceEquipe,
): Promise<{ titre: string; texte: string; quand: string; modifieeAt: string | null } | null> {
  const { data, error } = await supabase
    .from("annonces")
    .select("titre, corps, created_at, publiee_at, modifiee_at")
    .eq("id", id)
    .eq("etat", "publiee")
    .in("public", [...PUBLICS_DE[espace]])
    .maybeSingle();
  if (error) throw error;
  return data
    ? { titre: data.titre, texte: data.corps, quand: data.publiee_at ?? data.created_at, modifieeAt: data.modifiee_at }
    : null;
}

export type MessageEchange = { id: string; deLEquipe: boolean; texte: string; quand: string };

/** Toute la discussion avec l'équipe pour cet espace, du plus ancien au plus récent. */
export async function lireDiscussionEquipe(
  supabase: SupabaseClient<Database>,
  authUserId: string,
  espace: EspaceEquipe,
): Promise<MessageEchange[]> {
  const { data, error } = await supabase
    .from("fil_equipe")
    .select("id, de_l_equipe, corps, created_at")
    .eq("fil_de", authUserId)
    .eq("espace", espace)
    .order("created_at");
  if (error) throw error;
  return data.map((m) => ({ id: m.id, deLEquipe: m.de_l_equipe, texte: m.corps, quand: m.created_at }));
}

/** Une annonce telle que l'équipe la gère (0045). */
export type AnnonceAdmin = {
  id: string;
  titre: string;
  corps: string;
  public: Database["public"]["Enums"]["public_annonce"];
  etat: Database["public"]["Enums"]["etat_annonce"];
  creeeAt: string;
  programmeePour: string | null;
  publieeAt: string | null;
  modifieeAt: string | null;
  retireeAt: string | null;
  auteur: string | null;
  modifieePar: string | null;
  retireePar: string | null;
  destinataires: number;
  lues: number;
};

const COLONNES_ANNONCE =
  "id, titre, corps, public, etat, created_at, programmee_pour, publiee_at, modifiee_at, retiree_at, auteur_id, modifiee_par, retiree_par, annonce_destinataires(lue_at)";

type LigneAnnonce = {
  id: string;
  titre: string;
  corps: string;
  public: Database["public"]["Enums"]["public_annonce"];
  etat: Database["public"]["Enums"]["etat_annonce"];
  created_at: string;
  programmee_pour: string | null;
  publiee_at: string | null;
  modifiee_at: string | null;
  retiree_at: string | null;
  auteur_id: string | null;
  modifiee_par: string | null;
  retiree_par: string | null;
  annonce_destinataires: { lue_at: string | null }[];
};

async function nomsDeLEquipe(supabase: SupabaseClient<Database>): Promise<Map<string, string>> {
  const { data } = await supabase.from("equipe").select("auth_user_id, nom");
  return new Map((data ?? []).map((m) => [m.auth_user_id, m.nom]));
}

function versAnnonceAdmin(a: LigneAnnonce, noms: Map<string, string>): AnnonceAdmin {
  const nom = (id: string | null) => (id ? (noms.get(id) ?? "Ancien membre") : null);
  return {
    id: a.id,
    titre: a.titre,
    corps: a.corps,
    public: a.public,
    etat: a.etat,
    creeeAt: a.created_at,
    programmeePour: a.programmee_pour,
    publieeAt: a.publiee_at,
    modifieeAt: a.modifiee_at,
    retireeAt: a.retiree_at,
    auteur: nom(a.auteur_id),
    modifieePar: nom(a.modifiee_par),
    retireePar: nom(a.retiree_par),
    destinataires: a.annonce_destinataires.length,
    lues: a.annonce_destinataires.filter((d) => d.lue_at).length,
  };
}

/** Toutes les annonces, pour l'équipe : la plus récemment créée d'abord. */
export async function lireAnnoncesAdmin(supabase: SupabaseClient<Database>): Promise<AnnonceAdmin[]> {
  const [{ data, error }, noms] = await Promise.all([
    supabase.from("annonces").select(COLONNES_ANNONCE).order("created_at", { ascending: false }).returns<LigneAnnonce[]>(),
    nomsDeLEquipe(supabase),
  ]);
  if (error) throw error;
  return data.map((a) => versAnnonceAdmin(a, noms));
}

export type Lecteur = { id: string; nom: string; lueAt: string | null };

/** Une annonce et ses destinataires (lus ou non), pour l'équipe. */
export async function lireAnnonceAdmin(
  supabase: SupabaseClient<Database>,
  id: string,
): Promise<{ annonce: AnnonceAdmin; lecteurs: Lecteur[] } | null> {
  const [{ data, error }, noms, lecteurs] = await Promise.all([
    supabase.from("annonces").select(COLONNES_ANNONCE).eq("id", id).returns<LigneAnnonce[]>().maybeSingle(),
    nomsDeLEquipe(supabase),
    supabase.rpc("lecteurs_annonce", { p_annonce: id }),
  ]);
  if (error) throw error;
  if (!data) return null;
  return {
    annonce: versAnnonceAdmin(data, noms),
    lecteurs: (lecteurs.data ?? []).map((l) => ({ id: l.auth_user_id, nom: l.nom, lueAt: (l.lue_at as string | null) ?? null })),
  };
}
