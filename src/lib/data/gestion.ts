import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

/**
 * Ce que l'équipe gère depuis `/admin/gestion` (décision du porteur du
 * projet, 2026-11-07 : tout le site s'administre depuis `/admin`).
 * Comme la modération, tout passe par des fonctions de la base qui
 * exigent d'être de l'équipe (0063 à 0066) ; le site ne lit aucune table
 * en direct.
 */

type Client = SupabaseClient<Database>;
type Fonctions = Database["public"]["Functions"];

export type CompteGere = Fonctions["equipe_comptes"]["Returns"][number];
export type ProduitGere = Fonctions["equipe_produits"]["Returns"][number];
export type Membre = Fonctions["equipe_membres"]["Returns"][number];
export type Categorie = Database["public"]["Tables"]["categories"]["Row"];
export type Ville = Database["public"]["Tables"]["cities"]["Row"];

/** Une recherche nettoyée : vide = « les plus récents ». */
export function lireRecherche(brut: unknown): string | null {
  const q = typeof brut === "string" ? brut.trim().slice(0, 80) : "";
  return q || null;
}

export async function lireComptes(supabase: Client, recherche: string | null): Promise<CompteGere[]> {
  const { data, error } = await supabase.rpc("equipe_comptes", { p_recherche: recherche ?? undefined, p_limite: 50 });
  if (error) throw error;
  return data ?? [];
}

export const FILTRES_PRODUITS = {
  tous: "Tous",
  active: "En ligne",
  sold: "Vendus",
  hidden: "Masqués",
  draft: "Brouillons",
  masque_equipe: "Masqués par l'équipe",
} as const;
export type FiltreProduits = keyof typeof FILTRES_PRODUITS;

export function lireFiltreProduits(brut: unknown): FiltreProduits {
  return typeof brut === "string" && brut in FILTRES_PRODUITS ? (brut as FiltreProduits) : "tous";
}

export async function lireProduits(supabase: Client, recherche: string | null, filtre: FiltreProduits): Promise<ProduitGere[]> {
  const { data, error } = await supabase.rpc("equipe_produits", {
    p_recherche: recherche ?? undefined,
    p_statut: filtre === "tous" ? undefined : filtre,
    p_limite: 50,
  });
  if (error) throw error;
  return data ?? [];
}

export async function lireMembres(supabase: Client): Promise<Membre[]> {
  const { data, error } = await supabase.rpc("equipe_membres");
  if (error) throw error;
  return data ?? [];
}

/** Catégories et villes se lisent en clair : elles sont publiques (0001). */
export async function lireCatalogue(supabase: Client): Promise<{ categories: Categorie[]; villes: Ville[] }> {
  const [c, v] = await Promise.all([
    supabase.from("categories").select("*").order("position").order("name"),
    supabase.from("cities").select("*").order("position").order("name"),
  ]);
  if (c.error) throw c.error;
  if (v.error) throw v.error;
  return { categories: c.data, villes: v.data };
}
