import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { mapRow } from "@/lib/data/products";
import { compter } from "@/lib/analytics";
import { createPublicClient } from "@/lib/supabase/public";
import { shopPhotoUrl } from "@/lib/storage";
import type { Product } from "@/lib/types";

/**
 * La publicité de Filloo (0047, puis 0048 pour les prix). Un commerçant
 * DEMANDE une campagne au prix de la grille (`tarifs_publicite`, fixée par
 * l'équipe), paie par Orange Money ou MTN MoMo hors de Filloo et déclare
 * la référence ; l'équipe vérifie le paiement, puis accepte ou refuse.
 * L'équipe peut aussi créer une campagne elle-même (payée en main propre,
 * ou offerte).
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

/** Les moyens de paiement. Les deux premiers se déclarent par le commerçant ; les deux autres, seulement par l'équipe. */
export const MOYENS_PAIEMENT = {
  orange_money: "Orange Money",
  mtn_momo: "MTN MoMo",
  especes: "Espèces",
  offert: "Offert",
} as const;

export type MoyenPaiement = keyof typeof MOYENS_PAIEMENT;
export const MOYENS_MOBILES = ["orange_money", "mtn_momo"] as const;
export type MoyenMobile = (typeof MOYENS_MOBILES)[number];

export function lireMoyen(valeur: unknown): MoyenPaiement | null {
  return typeof valeur === "string" && valeur in MOYENS_PAIEMENT ? (valeur as MoyenPaiement) : null;
}

export function lireTypeCampagne(valeur: unknown): TypeCampagne | null {
  return typeof valeur === "string" && valeur in TYPES_CAMPAGNE ? (valeur as TypeCampagne) : null;
}

export type ProduitSponsorise = Product & { campagneId: string };

/**
 * Les produits sponsorisés d'un emplacement, dans un ordre tiré par la base
 * (rotation entre annonceurs). PAS de cache : la rotation changerait une
 * fois par minute au lieu d'à chaque visite, et la requête est petite.
 */
export async function produitsSponsorises(opts: { query?: string | null; categoryId?: number | null; limit?: number }): Promise<ProduitSponsorise[]> {
  const { data, error } = await createPublicClient().rpc("produits_sponsorises", {
    p_query: opts.query || undefined,
    p_category_id: opts.categoryId ?? undefined,
    p_limit: opts.limit ?? 2,
  });
  // Une panne de la publicité ne doit jamais vider l'accueil : on l'oublie.
  if (error) {
    console.error("[publicité] produits sponsorisés illisibles :", error.message);
    return [];
  }
  return (data ?? []).map((row) => ({ ...mapRow(row), campagneId: row.campagne_id }));
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
  const { data, error } = await createPublicClient().rpc("boutiques_mises_en_avant", { p_limit: limit });
  if (error) {
    console.error("[publicité] boutiques mises en avant illisibles :", error.message);
    return [];
  }
  return (data ?? []).map((b) => ({
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
export type EtatCampagne = "a_payer" | "en_attente" | "active" | "terminee" | "refusee" | "annulee" | "interrompue";

export function etatCampagne(c: { statut: string; fin_at: string | null }, maintenant = new Date()): EtatCampagne {
  if (c.statut === "active" && c.fin_at && new Date(c.fin_at) <= maintenant) return "terminee";
  return c.statut as EtatCampagne;
}

/**
 * Un paiement à rendre : payé (déclaré ou confirmé), puis refusé, ou annulé
 * avant la mise en ligne. Une campagne interrompue en cours ne l'est pas
 * d'office : l'équipe juge, et peut quand même la marquer remboursée.
 */
export function estARembourser(c: {
  statut: string;
  prix_gnf: number | null;
  paiement_declare_at: string | null;
  paiement_confirme_at: string | null;
  debut_at: string | null;
  rembourse_at: string | null;
}): boolean {
  const paye = !!(c.paiement_declare_at || c.paiement_confirme_at) && (c.prix_gnf ?? 0) > 0;
  if (!paye || c.rembourse_at) return false;
  return c.statut === "refusee" || (c.statut === "annulee" && !c.debut_at);
}

export type Tarifs = Record<TypeCampagne, Partial<Record<(typeof DUREES)[number], number>>>;

/** La grille des prix, lisible par tous (0048). Une case vide : l'offre n'a pas encore de prix. */
export async function lireTarifs(supabase: Client): Promise<Tarifs> {
  const { data, error } = await supabase.from("tarifs_publicite").select("type, duree_jours, prix_gnf");
  if (error) throw error;
  const tarifs: Tarifs = { produit: {}, categorie: {}, boutique: {} };
  for (const t of data ?? []) {
    const type = lireTypeCampagne(t.type);
    if (type && DUREES.includes(t.duree_jours as (typeof DUREES)[number])) {
      tarifs[type][t.duree_jours as (typeof DUREES)[number]] = t.prix_gnf;
    }
  }
  return tarifs;
}

export type MoyenDePaiement = { moyen: MoyenMobile; numero: string; titulaire: string; actif: boolean };

/** Les numéros officiels où le commerçant envoie son paiement (0048). */
export async function lireMoyensPaiement(supabase: Client): Promise<MoyenDePaiement[]> {
  const { data, error } = await supabase.from("moyens_paiement").select("moyen, numero, titulaire, actif").order("moyen");
  if (error) throw error;
  return (data ?? []).map((m) => ({ ...m, moyen: m.moyen as MoyenMobile }));
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
  prixGnf: number | null;
  paiementMoyen: MoyenPaiement | null;
  paiementReference: string | null;
  paiementDeclareAt: string | null;
  paiementConfirmeAt: string | null;
  rembourseAt: string | null;
  aRembourser: boolean;
  offerteParLEquipe: boolean;
};

export async function mesCampagnes(supabase: Client): Promise<CampagneCommercant[]> {
  const [{ data, error }, { data: resultats, error: erreurResultats }] = await Promise.all([
    supabase
      .from("campagnes")
      .select(
        "id, type, statut, duree_jours, debut_at, fin_at, motif, created_at, prix_gnf, paiement_moyen, paiement_reference, paiement_declare_at, paiement_confirme_at, rembourse_at, creee_par_equipe, products(title), categories(name)",
      )
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
    prixGnf: c.prix_gnf,
    paiementMoyen: lireMoyen(c.paiement_moyen),
    paiementReference: c.paiement_reference,
    paiementDeclareAt: c.paiement_declare_at,
    paiementConfirmeAt: c.paiement_confirme_at,
    rembourseAt: c.rembourse_at,
    aRembourser: estARembourser(c),
    offerteParLEquipe: !!c.creee_par_equipe,
  }));
}

export type CampagneEquipe = Database["public"]["Functions"]["campagnes_equipe"]["Returns"][number] & {
  etat: EtatCampagne;
  vues: number;
  clics: number;
  aRembourser: boolean;
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
    aRembourser: estARembourser(c),
  }));
}

export type RevenuDuMois = { mois: string; encaisse: number; rembourse: number; campagnes: number };

/** Ce que la publicité a rapporté, mois par mois (0048, équipe seulement). */
export async function revenusPublicite(supabase: Client): Promise<RevenuDuMois[]> {
  const { data, error } = await supabase.rpc("revenus_publicite");
  if (error) throw error;
  return (data ?? []).map((r) => ({
    mois: r.mois,
    encaisse: Number(r.encaisse_gnf ?? 0),
    rembourse: Number(r.rembourse_gnf ?? 0),
    campagnes: Number(r.campagnes ?? 0),
  }));
}

export type BoutiqueChoisie = { id: string; nom: string };

/** Les boutiques en ligne, pour que l'équipe crée une campagne à l'une d'elles. */
export async function boutiquesEnLigne(supabase: Client): Promise<BoutiqueChoisie[]> {
  const { data, error } = await supabase
    .from("merchants")
    .select("id, shop_name")
    .eq("status", "approved")
    .order("shop_name")
    .limit(500);
  if (error) throw error;
  return (data ?? []).map((m) => ({ id: m.id, nom: m.shop_name }));
}
