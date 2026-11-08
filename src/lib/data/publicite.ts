import { unstable_cache } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { mapRow } from "@/lib/data/products";
import { compter } from "@/lib/analytics";
import { createPublicClient } from "@/lib/supabase/public";
import { shopPhotoUrl } from "@/lib/storage";
import type { Product } from "@/lib/types";
import { CATALOGUE } from "@/lib/data/catalogue-public";

/**
 * La publicité de Filloo (0047, étape 2 du document de monétisation,
 * 2026-11-06). Pas encore de paiement : un commerçant DEMANDE une campagne,
 * l'équipe l'accepte ou la refuse, et elle tourne pour la durée choisie.
 *
 * Trois emplacements, pas un de plus, pour ne pas noyer les clients :
 * - l'accueil : au plus 2 produits sponsorisés et la rangée « Boutiques à
 *   découvrir » ;
 * - les résultats de recherche : au plus 2, pertinents pour la recherche ;
 * - une catégorie : au plus 2, de cette catégorie.
 * Toujours marqués « Sponsorisé », et les mêmes pour tout le monde : les
 * goûts de l'appareil (`gouts.ts`) ne choisissent jamais une publicité.
 */

type Client = SupabaseClient<Database>;

export const TYPES_CAMPAGNE = {
  produit: { libelle: "Produit sponsorisé", aide: "Votre produit en tête de l'accueil et des recherches qui le concernent." },
  categorie: { libelle: "Promotion dans une catégorie", aide: "Votre produit en tête de sa catégorie." },
  boutique: { libelle: "Boutique mise en avant", aide: "Votre boutique dans « Boutiques à découvrir » sur l'accueil." },
} as const;

export type TypeCampagne = keyof typeof TYPES_CAMPAGNE;

export const DUREES = [3, 7, 14, 30] as const;

/**
 * Les commerçants peuvent-ils DEMANDER une publicité ? Fermé par le
 * porteur du projet le 2026-11-07, « pour l'instant » : la page reste
 * visible (et ses publicités passées), le formulaire est grisé, l'action
 * refuse. L'équipe, elle, crée et valide toujours depuis `/admin/publicite`.
 * Rouvrir = passer à `true`.
 */
export const DEMANDES_PUB_OUVERTES = false;

export function lireTypeCampagne(valeur: unknown): TypeCampagne | null {
  return typeof valeur === "string" && valeur in TYPES_CAMPAGNE ? (valeur as TypeCampagne) : null;
}

export type ProduitSponsorise = Product & { campagneId: string };

/**
 * Les plafonds de la base (0047) : `produits_sponsorises` ne rend jamais
 * plus de 4 lignes, `boutiques_mises_en_avant` jamais plus de 12.
 */
const PLAFOND_PRODUITS = 4;
const PLAFOND_BOUTIQUES = 12;

/** Fisher-Yates : un ordre au hasard, sans biais. */
function auHasard<T>(liste: readonly T[]): T[] {
  const copie = [...liste];
  for (let i = copie.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copie[i], copie[j]] = [copie[j], copie[i]];
  }
  return copie;
}

/**
 * Les CANDIDATS d'un emplacement, lus une minute en cache (2026-11-07).
 * Avant, chaque visite de l'accueil appelait la base deux fois pour la
 * publicité (306 + 152 appels en 24 h, presque toujours pour rendre une
 * liste vide : 0 campagne). On lit maintenant le plafond de la base une
 * fois par minute et la ROTATION se fait à chaque visite, ici, parmi ces
 * candidats : tant qu'il y a au plus 4 produits (12 boutiques) en
 * campagne, c'est exactement le tirage d'avant ; au-delà, le lot change
 * une fois par minute. Étiquette `CATALOGUE` : une suspension ou une
 * décision sur une campagne vide le cache aussitôt.
 */
const candidatsProduitsEnCache = unstable_cache(
  async (query: string | null, categoryId: number | null) => {
    const { data, error } = await createPublicClient().rpc("produits_sponsorises", {
      p_query: query || undefined,
      p_category_id: categoryId ?? undefined,
      p_limit: PLAFOND_PRODUITS,
    });
    // Lever plutôt que rendre [] : une panne ne doit pas rester une minute en cache.
    if (error) throw new Error(error.message);
    return data ?? [];
  },
  ["produits-sponsorises"],
  { revalidate: 60, tags: [CATALOGUE] },
);

const candidatsBoutiquesEnCache = unstable_cache(
  async () => {
    const { data, error } = await createPublicClient().rpc("boutiques_mises_en_avant", { p_limit: PLAFOND_BOUTIQUES });
    if (error) throw new Error(error.message);
    return data ?? [];
  },
  ["boutiques-mises-en-avant"],
  { revalidate: 60, tags: [CATALOGUE] },
);

/**
 * Les produits sponsorisés d'un emplacement, dans un ordre tiré à chaque
 * visite parmi les candidats en cache (voir plus haut).
 */
export async function produitsSponsorises(opts: { query?: string | null; categoryId?: number | null; limit?: number }): Promise<ProduitSponsorise[]> {
  let candidats;
  try {
    candidats = await candidatsProduitsEnCache(opts.query?.trim() || null, opts.categoryId ?? null);
  } catch (cause) {
    // Une panne de la publicité ne doit jamais vider l'accueil : on l'oublie.
    console.error("[publicité] produits sponsorisés illisibles :", cause instanceof Error ? cause.message : cause);
    return [];
  }
  return auHasard(candidats)
    .slice(0, opts.limit ?? 2)
    .map((row) => ({ ...mapRow(row), campagneId: row.campagne_id }));
}

export type BoutiqueEnAvant = {
  campagneId: string;
  id: string;
  nom: string;
  ville: string;
  photoUrl: string | null;
  produitsActifs: number;
};

export async function boutiquesMisesEnAvant(limit = 6): Promise<BoutiqueEnAvant[]> {
  let candidates;
  try {
    candidates = await candidatsBoutiquesEnCache();
  } catch (cause) {
    console.error("[publicité] boutiques mises en avant illisibles :", cause instanceof Error ? cause.message : cause);
    return [];
  }
  return auHasard(candidates)
    .slice(0, limit)
    .map((b) => ({
      campagneId: b.campagne_id,
      id: b.merchant_id,
      nom: b.shop_name,
      ville: b.city_name,
      photoUrl: b.shop_photo_path ? shopPhotoUrl(b.shop_photo_path) : null,
      produitsActifs: b.produits_actifs,
    }));
}

/** Un affichage par campagne montrée (les robots ne comptent pas, voir `compter`). */
export async function compterAffichages(campagnes: string[]): Promise<void> {
  await Promise.all([...new Set(campagnes)].map((id) => compter("pub_vue", { campagneId: id })));
}

/** Le lien d'une publicité passe par `/pub/[id]`, qui compte le clic puis mène à la fiche. */
export function lienPub(campagneId: string): string {
  return `/pub/${campagneId}`;
}

/** Le statut tel qu'on le dit : une campagne active dont la fin est passée est « terminée ». */
export type EtatCampagne = "en_attente" | "active" | "terminee" | "refusee" | "annulee" | "interrompue";

export function etatCampagne(c: { statut: string; fin_at: string | null }, maintenant = new Date()): EtatCampagne {
  if (c.statut === "active" && c.fin_at && new Date(c.fin_at) <= maintenant) return "terminee";
  return c.statut as EtatCampagne;
}

export type CampagneCommercant = {
  id: string;
  type: TypeCampagne;
  etat: EtatCampagne;
  dureeJours: number;
  debutAt: string | null;
  finAt: string | null;
  motif: string | null;
  creeeAt: string;
  produitTitre: string | null;
  categorie: string | null;
  vues: number;
  clics: number;
};

export async function mesCampagnes(supabase: Client): Promise<CampagneCommercant[]> {
  const [{ data, error }, { data: resultats, error: erreurResultats }] = await Promise.all([
    supabase
      .from("campagnes")
      .select("id, type, statut, duree_jours, debut_at, fin_at, motif, created_at, products(title), categories(name)")
      .order("created_at", { ascending: false })
      .limit(50),
    supabase.rpc("resultats_campagnes"),
  ]);
  if (error) throw error;
  if (erreurResultats) throw erreurResultats;
  const parCampagne = new Map((resultats ?? []).map((r) => [r.campagne_id, r]));
  return data.map((c) => ({
    id: c.id,
    type: c.type as TypeCampagne,
    etat: etatCampagne(c),
    dureeJours: c.duree_jours,
    debutAt: c.debut_at,
    finAt: c.fin_at,
    motif: c.motif,
    creeeAt: c.created_at,
    produitTitre: c.products?.title ?? null,
    categorie: c.categories?.name ?? null,
    vues: Number(parCampagne.get(c.id)?.vues ?? 0),
    clics: Number(parCampagne.get(c.id)?.clics ?? 0),
  }));
}

export type CampagneEquipe = Database["public"]["Functions"]["campagnes_equipe"]["Returns"][number] & {
  etat: EtatCampagne;
  vues: number;
  clics: number;
};

export async function campagnesEquipe(supabase: Client): Promise<CampagneEquipe[]> {
  const [{ data, error }, { data: resultats, error: erreurResultats }] = await Promise.all([
    supabase.rpc("campagnes_equipe"),
    supabase.rpc("resultats_campagnes"),
  ]);
  if (error) throw error;
  if (erreurResultats) throw erreurResultats;
  const parCampagne = new Map((resultats ?? []).map((r) => [r.campagne_id, r]));
  return (data ?? []).map((c) => ({
    ...c,
    etat: etatCampagne(c),
    vues: Number(parCampagne.get(c.id)?.vues ?? 0),
    clics: Number(parCampagne.get(c.id)?.clics ?? 0),
  }));
}
