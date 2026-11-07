import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

/**
 * La modération de l'équipe (0046, décision du 2026-11-06) : les
 * signalements à traiter, les comptes suspendus, et l'historique de ce que
 * l'équipe a fait. Tout passe par des fonctions de la base qui exigent
 * d'être de l'équipe : le site ne lit jamais `reports` ni les conversations
 * en direct.
 */

type Client = SupabaseClient<Database>;

export type Signalement = Database["public"]["Functions"]["signalements_a_traiter"]["Returns"][number];

export async function lireSignalements(supabase: Client): Promise<Signalement[]> {
  const { data, error } = await supabase.rpc("signalements_a_traiter");
  if (error) throw error;
  return data ?? [];
}

export async function lireSignalement(supabase: Client, id: string): Promise<Signalement | null> {
  return (await lireSignalements(supabase)).find((s) => s.id === id) ?? null;
}

export type MessageSignale = Database["public"]["Functions"]["messages_signales"]["Returns"][number];

/** Seulement pour un fil signalé : le signaleur a été prévenu que l'équipe le lirait. */
export async function lireMessagesSignales(supabase: Client, reportId: string): Promise<MessageSignale[]> {
  const { data, error } = await supabase.rpc("messages_signales", { p_report: reportId });
  if (error) throw error;
  // La base rend les 50 derniers, plus récents d'abord ou non : on les lit dans l'ordre du fil.
  return [...(data ?? [])].sort((a, b) => a.created_at.localeCompare(b.created_at));
}

export type CompteTresSignale = Database["public"]["Functions"]["comptes_tres_signales"]["Returns"][number];

/** Les personnes signalées par 5 personnes différentes ou plus (0055), à traiter en premier. */
export async function lireComptesTresSignales(supabase: Client): Promise<CompteTresSignale[]> {
  const { data, error } = await supabase.rpc("comptes_tres_signales");
  if (error) throw error;
  return data ?? [];
}

export type CompteSuspendu = Database["public"]["Functions"]["comptes_suspendus"]["Returns"][number];

export async function lireComptesSuspendus(supabase: Client): Promise<CompteSuspendu[]> {
  const { data, error } = await supabase.rpc("comptes_suspendus");
  if (error) throw error;
  return data ?? [];
}

export type EntreeJournal = Database["public"]["Tables"]["journal_equipe"]["Row"];

/** Les 200 dernières actions : assez pour relire un mois d'activité à l'échelle actuelle. */
export async function lireJournal(supabase: Client): Promise<EntreeJournal[]> {
  const { data, error } = await supabase
    .from("journal_equipe")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  return data;
}

export const ACTIONS_JOURNAL = {
  suspendre: "a suspendu un compte",
  reactiver: "a réactivé un compte",
  masquer_produit: "a masqué un produit",
  classer_signalement: "a traité un signalement",
  demasquer_produit: "a démasqué un produit",
  ajouter_membre: "a ajouté un membre à l'équipe",
  retirer_membre: "a retiré un membre de l'équipe",
  fixer_categorie: "a créé ou modifié une catégorie",
  retirer_categorie: "a retiré une catégorie",
  fixer_ville: "a créé ou modifié une ville",
  retirer_ville: "a retiré une ville",
} as const satisfies Record<string, string>;

export const DECISIONS = {
  sans_suite: "Classé sans suite",
  produit_masque: "Produit masqué",
  compte_suspendu: "Compte suspendu",
} as const;

export type Decision = keyof typeof DECISIONS;

export function lireDecision(valeur: unknown): Decision | null {
  return typeof valeur === "string" && valeur in DECISIONS ? (valeur as Decision) : null;
}
