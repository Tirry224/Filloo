import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { abonnementARembourser, etatAbonnement, type EtatAbonnement } from "@/lib/data/abonnements";
import { lireMoyen, type MoyenPaiement } from "@/lib/data/publicite";

/**
 * Les crédits de publicité (0050, décisions du porteur du projet du
 * 2026-11-07) : 1 crédit = 1 000 GNF ; packs de 10, 25 ou 50, payés comme
 * le reste et valables 12 mois ; Business en reçoit chaque mois (10 par
 * défaut), perdus à la fin de la période. Ils paient une publicité ; si
 * l'équipe la refuse, ils reviennent tout seuls.
 */

type Client = SupabaseClient<Database>;

export const GNF_PAR_CREDIT = 1000;
export const PACKS = [10, 25, 50] as const;
export type Pack = (typeof PACKS)[number];

export function lirePack(valeur: unknown): Pack | null {
  const n = Number(valeur);
  return PACKS.includes(n as Pack) ? (n as Pack) : null;
}

/** « 1 crédit », « 15 crédits ». */
export function credits(n: number): string {
  return `${n} crédit${Math.abs(n) > 1 ? "s" : ""}`;
}

export type MesCredits = { disponibles: number; expirentSous30Jours: number; prochaineExpiration: string | null };

export async function mesCredits(supabase: Client): Promise<MesCredits> {
  const { data, error } = await supabase.rpc("mes_credits");
  if (error) throw error;
  const r = data?.[0];
  return {
    disponibles: r?.disponibles ?? 0,
    expirentSous30Jours: r?.expirent_sous_30_jours ?? 0,
    prochaineExpiration: r?.prochaine_expiration ?? null,
  };
}

export type LotCredits = {
  id: string;
  origine: "achat" | "abonnement" | "equipe";
  initiaux: number;
  restants: number;
  disponibleAt: string;
  expireAt: string;
  motif: string | null;
  creeAt: string;
};

/** Chaque lot, du plus récent au plus ancien : d'où viennent les crédits, et quand ils expirent. */
export async function mesLotsCredits(supabase: Client): Promise<LotCredits[]> {
  const { data, error } = await supabase
    .from("lots_credits")
    .select("id, origine, credits_initiaux, credits_restants, disponible_at, expire_at, motif, created_at")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data ?? []).map((l) => ({
    id: l.id,
    origine: l.origine as LotCredits["origine"],
    initiaux: l.credits_initiaux,
    restants: l.credits_restants,
    disponibleAt: l.disponible_at,
    expireAt: l.expire_at,
    motif: l.motif,
    creeAt: l.created_at,
  }));
}

export type AchatCredits = {
  id: string;
  credits: number;
  etat: EtatAbonnement;
  prixGnf: number;
  paiementMoyen: MoyenPaiement | null;
  paiementReference: string | null;
  motif: string | null;
  rembourseAt: string | null;
  aRembourser: boolean;
  creeAt: string;
};

export async function mesAchatsCredits(supabase: Client): Promise<AchatCredits[]> {
  const { data, error } = await supabase
    .from("achats_credits")
    .select(
      "id, credits, statut, prix_gnf, motif, paiement_moyen, paiement_reference, paiement_declare_at, paiement_confirme_at, rembourse_at, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(24);
  if (error) throw error;
  return (data ?? []).map((a) => ({
    id: a.id,
    credits: a.credits,
    // Un achat ne « se termine » pas : seul son statut compte.
    etat: etatAbonnement({ statut: a.statut, fin_at: null }),
    prixGnf: a.prix_gnf,
    paiementMoyen: lireMoyen(a.paiement_moyen),
    paiementReference: a.paiement_reference,
    motif: a.motif,
    rembourseAt: a.rembourse_at,
    aRembourser: abonnementARembourser({ ...a, debut_at: null }),
    creeAt: a.created_at,
  }));
}

export type AchatCreditsEquipe = Database["public"]["Functions"]["achats_credits_equipe"]["Returns"][number] & {
  etat: EtatAbonnement;
  aRembourser: boolean;
};

export async function achatsCreditsEquipe(supabase: Client): Promise<AchatCreditsEquipe[]> {
  const { data, error } = await supabase.rpc("achats_credits_equipe");
  if (error) throw error;
  return (data ?? []).map((a) => ({
    ...a,
    etat: etatAbonnement({ statut: a.statut, fin_at: null }),
    aRembourser: abonnementARembourser({ ...a, debut_at: null }),
  }));
}

export type SoldeBoutique = { merchantId: string; nom: string; disponibles: number };

export async function soldesEquipe(supabase: Client): Promise<SoldeBoutique[]> {
  const { data, error } = await supabase.rpc("credits_equipe");
  if (error) throw error;
  return (data ?? []).map((s) => ({ merchantId: s.merchant_id, nom: s.shop_name, disponibles: s.disponibles }));
}

export async function revenusCredits(supabase: Client) {
  const { data, error } = await supabase.rpc("revenus_credits");
  if (error) throw error;
  return (data ?? []).map((r) => ({
    mois: r.mois,
    encaisse: Number(r.encaisse_gnf ?? 0),
    rembourse: Number(r.rembourse_gnf ?? 0),
    campagnes: Number(r.achats ?? 0),
  }));
}

export async function creditsInclus(supabase: Client): Promise<Partial<Record<"pro" | "business", number>>> {
  const { data, error } = await supabase.from("tarifs_abonnement").select("formule, credits_inclus");
  if (error) throw error;
  const r: Partial<Record<"pro" | "business", number>> = {};
  for (const t of data ?? []) if (t.formule === "pro" || t.formule === "business") r[t.formule] = t.credits_inclus;
  return r;
}
