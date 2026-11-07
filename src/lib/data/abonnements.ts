import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { lireMoyen, type MoyenPaiement } from "@/lib/data/publicite";
import { createPublicClient } from "@/lib/supabase/public";

/**
 * Les abonnements des boutiques (0049, décisions du porteur du projet du
 * 2026-11-07) : Gratuit (10 produits publiés), Pro et Business, au mois,
 * payés comme la publicité (Orange Money ou MTN MoMo, vérifiés par
 * l'équipe). Sept jours de grâce après la fin ; ensuite, retour en
 * Gratuit et les produits au-delà de 10 sont masqués, jamais supprimés.
 * Le badge ne s'affiche que pendant la période payée.
 */

type Client = SupabaseClient<Database>;

export const FORMULES = {
  gratuit: {
    libelle: "Gratuit",
    avantages: ["10 produits publiés", "Messages et WhatsApp", "Présence dans les recherches"],
  },
  pro: {
    libelle: "Pro",
    avantages: ["Produits illimités", "Vos statistiques sur l'accueil", "Graphique de vos visites", "Badge PRO"],
  },
  business: {
    libelle: "Business",
    avantages: ["Tout Pro", "Page Statistiques détaillée", "Tendances de Filloo : recherches et catégories", "Badge BUSINESS"],
  },
} as const;

export type Formule = keyof typeof FORMULES;
export type FormulePayante = Exclude<Formule, "gratuit">;
export const FORMULES_PAYANTES = ["pro", "business"] as const;

export function lireFormulePayante(valeur: unknown): FormulePayante | null {
  return valeur === "pro" || valeur === "business" ? valeur : null;
}

export type MaFormule = { formule: Formule; finAt: string | null; enGrace: boolean; limiteProduits: number | null };

/** La formule de la boutique connectée, telle que la base l'applique. */
export async function maFormule(supabase: Client): Promise<MaFormule> {
  const { data, error } = await supabase.rpc("ma_formule");
  if (error) throw error;
  const r = data?.[0];
  const formule: Formule = r?.formule === "pro" || r?.formule === "business" ? r.formule : "gratuit";
  return { formule, finAt: r?.fin_at ?? null, enGrace: !!r?.en_grace, limiteProduits: r?.limite_produits ?? (formule === "gratuit" ? 10 : null) };
}

export type TarifsAbonnement = Partial<Record<FormulePayante, number>>;

export async function lireTarifsAbonnement(supabase: Client): Promise<TarifsAbonnement> {
  const { data, error } = await supabase.from("tarifs_abonnement").select("formule, prix_gnf");
  if (error) throw error;
  const t: TarifsAbonnement = {};
  for (const r of data ?? []) {
    const f = lireFormulePayante(r.formule);
    if (f) t[f] = r.prix_gnf;
  }
  return t;
}

export type EtatAbonnement = "a_payer" | "en_attente" | "active" | "terminee" | "refusee" | "annulee" | "interrompue";

export function etatAbonnement(a: { statut: string; fin_at: string | null }, maintenant = new Date()): EtatAbonnement {
  if (a.statut === "active" && a.fin_at && new Date(a.fin_at) <= maintenant) return "terminee";
  return a.statut as EtatAbonnement;
}

/** Même règle que la publicité : payé puis refusé, ou annulé avant de commencer. */
export function abonnementARembourser(a: {
  statut: string;
  prix_gnf: number | null;
  paiement_declare_at: string | null;
  paiement_confirme_at: string | null;
  debut_at: string | null;
  rembourse_at: string | null;
}): boolean {
  const paye = !!(a.paiement_declare_at || a.paiement_confirme_at) && (a.prix_gnf ?? 0) > 0;
  if (!paye || a.rembourse_at) return false;
  return a.statut === "refusee" || (a.statut === "annulee" && !a.debut_at);
}

export type AbonnementCommercant = {
  id: string;
  formule: FormulePayante;
  etat: EtatAbonnement;
  prixGnf: number | null;
  debutAt: string | null;
  finAt: string | null;
  motif: string | null;
  paiementMoyen: MoyenPaiement | null;
  paiementReference: string | null;
  rembourseAt: string | null;
  aRembourser: boolean;
  offertParLEquipe: boolean;
  creeAt: string;
};

export async function mesAbonnements(supabase: Client): Promise<AbonnementCommercant[]> {
  const { data, error } = await supabase
    .from("abonnements")
    .select(
      "id, formule, statut, prix_gnf, debut_at, fin_at, motif, paiement_moyen, paiement_reference, paiement_declare_at, paiement_confirme_at, rembourse_at, creee_par_equipe, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(24);
  if (error) throw error;
  return (data ?? []).map((a) => ({
    id: a.id,
    formule: lireFormulePayante(a.formule) ?? "pro",
    etat: etatAbonnement(a),
    prixGnf: a.prix_gnf,
    debutAt: a.debut_at,
    finAt: a.fin_at,
    motif: a.motif,
    paiementMoyen: lireMoyen(a.paiement_moyen),
    paiementReference: a.paiement_reference,
    rembourseAt: a.rembourse_at,
    aRembourser: abonnementARembourser(a),
    offertParLEquipe: !!a.creee_par_equipe,
    creeAt: a.created_at,
  }));
}

export type AbonnementEquipe = Database["public"]["Functions"]["abonnements_equipe"]["Returns"][number] & {
  etat: EtatAbonnement;
  aRembourser: boolean;
};

export async function abonnementsEquipe(supabase: Client): Promise<AbonnementEquipe[]> {
  const { data, error } = await supabase.rpc("abonnements_equipe");
  if (error) throw error;
  return (data ?? []).map((a) => ({ ...a, etat: etatAbonnement(a), aRembourser: abonnementARembourser(a) }));
}

export async function revenusAbonnements(supabase: Client) {
  const { data, error } = await supabase.rpc("revenus_abonnements");
  if (error) throw error;
  return (data ?? []).map((r) => ({
    mois: r.mois,
    encaisse: Number(r.encaisse_gnf ?? 0),
    rembourse: Number(r.rembourse_gnf ?? 0),
    campagnes: Number(r.abonnements ?? 0),
  }));
}

/**
 * Les badges des boutiques affichées, en UNE requête par écran. Une panne
 * n'enlève que les badges : jamais la page.
 */
export async function badgesBoutiques(ids: string[]): Promise<Map<string, FormulePayante>> {
  const uniques = [...new Set(ids)];
  if (uniques.length === 0) return new Map();
  const { data, error } = await createPublicClient().rpc("badges_boutiques", { p_merchants: uniques });
  if (error) {
    console.error("[abonnements] badges illisibles :", error.message);
    return new Map();
  }
  const m = new Map<string, FormulePayante>();
  for (const b of data ?? []) {
    const f = lireFormulePayante(b.formule);
    if (f) m.set(b.merchant_id, f);
  }
  return m;
}

export type JourStat = { jour: string; boutiqueVues: number; produitsVus: number; contacts: number; whatsapp: number };

export async function statistiquesBoutique(supabase: Client, jours = 30): Promise<JourStat[]> {
  const { data, error } = await supabase.rpc("statistiques_boutique", { p_jours: jours });
  if (error) throw error;
  return (data ?? []).map((d) => ({
    jour: d.jour,
    boutiqueVues: Number(d.boutique_vues),
    produitsVus: Number(d.produits_vus),
    contacts: Number(d.contacts),
    whatsapp: Number(d.whatsapp),
  }));
}

export type ProduitVu = { id: string; titre: string; vues: number; contacts: number };

export async function produitsLesPlusVus(supabase: Client, jours = 30): Promise<ProduitVu[]> {
  const { data, error } = await supabase.rpc("produits_les_plus_vus", { p_jours: jours });
  if (error) throw error;
  return (data ?? []).map((p) => ({ id: p.product_id, titre: p.titre, vues: Number(p.vues), contacts: Number(p.contacts) }));
}

export type Tendance = { genre: "recherche" | "recherche_sans_resultat" | "categorie"; libelle: string; total: number };

export async function tendancesFilloo(supabase: Client, jours = 30): Promise<Tendance[]> {
  const { data, error } = await supabase.rpc("tendances_filloo", { p_jours: jours });
  if (error) throw error;
  return (data ?? []).map((t) => ({ genre: t.genre as Tendance["genre"], libelle: t.libelle, total: Number(t.total) }));
}
