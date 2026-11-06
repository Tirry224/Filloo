/**
 * Les goûts d'un appareil : quelles catégories et quelles boutiques il
 * regarde souvent (décision du porteur du projet, 2026-11-06 : « proposer
 * plus de ce qu'il a l'habitude de chercher, en mélangeant d'autres »).
 *
 * Gardés dans un COOKIE de l'appareil, jamais en base : le serveur le lit
 * pour ordonner l'accueil et l'oublie aussitôt. Aucun identifiant : deux
 * appareils aux mêmes goûts portent le même cookie. Vider les données du
 * navigateur l'efface. Voir la politique de confidentialité, article 4.
 *
 * Partagé entre le serveur (lecture) et le navigateur (écriture) : aucune
 * dépendance à l'un ou à l'autre ici.
 */

export const COOKIE_GOUTS = "filloo_gouts";
/** Six mois : un goût qui n'est plus nourri s'efface de lui-même par l'oubli ci-dessous. */
export const DUREE_GOUTS_S = 60 * 60 * 24 * 180;

/** Au-delà, les plus faibles tombent : le cookie reste petit (< 1 Ko). */
const CATEGORIES_MAX = 8;
const BOUTIQUES_MAX = 6;
/** Chaque nouvelle visite pèse plus que les anciennes : les goûts suivent la personne. */
const OUBLI = 0.85;

export type Gouts = {
  /** Catégorie (par son nom, celui des cartes) → poids. */
  c: Record<string, number>;
  /** Boutique (par son identifiant) → poids. */
  b: Record<string, number>;
};

export const GOUTS_VIDES: Gouts = { c: {}, b: {} };

function nettoyer(brut: unknown, max: number, cle: (k: string) => boolean): Record<string, number> {
  if (!brut || typeof brut !== "object") return {};
  return Object.fromEntries(
    Object.entries(brut as Record<string, unknown>)
      .filter(([k, v]) => cle(k) && typeof v === "number" && Number.isFinite(v) && v > 0)
      .map(([k, v]) => [k, Math.min(v as number, 50)] as const)
      .sort((a, b) => b[1] - a[1])
      .slice(0, max),
  );
}

/** Un cookie illisible, trafiqué ou trop gros vaut « aucun goût », jamais une erreur. */
export function lireGouts(valeur: string | undefined | null): Gouts {
  if (!valeur || valeur.length > 2000) return GOUTS_VIDES;
  try {
    const brut = JSON.parse(decodeURIComponent(valeur)) as { c?: unknown; b?: unknown };
    return {
      c: nettoyer(brut.c, CATEGORIES_MAX, (k) => k.length <= 60),
      b: nettoyer(brut.b, BOUTIQUES_MAX, (k) => /^[0-9a-f-]{36}$/i.test(k)),
    };
  } catch {
    return GOUTS_VIDES;
  }
}

function arrondir(poids: Record<string, number>): Record<string, number> {
  return Object.fromEntries(Object.entries(poids).map(([k, v]) => [k, Math.round(v * 100) / 100]));
}

/** Une fiche vue (ou une catégorie choisie) nourrit les goûts ; tout le reste s'estompe un peu. */
export function nourrirGouts(gouts: Gouts, vu: { categorie?: string | null; boutique?: string | null }): Gouts {
  const c = Object.fromEntries(Object.entries(gouts.c).map(([k, v]) => [k, v * OUBLI]));
  const b = Object.fromEntries(Object.entries(gouts.b).map(([k, v]) => [k, v * OUBLI]));
  if (vu.categorie) c[vu.categorie] = (c[vu.categorie] ?? 0) + 1;
  if (vu.boutique) b[vu.boutique] = (b[vu.boutique] ?? 0) + 1;
  return {
    c: arrondir(nettoyer(c, CATEGORIES_MAX, () => true)),
    b: arrondir(nettoyer(b, BOUTIQUES_MAX, () => true)),
  };
}

export function ecrireGouts(gouts: Gouts): string {
  return encodeURIComponent(JSON.stringify(gouts));
}

/** La part d'intérêt (0 à 1) d'une catégorie ou d'une boutique dans les goûts. */
export function affinite(poids: Record<string, number>, cle: string): number {
  const max = Math.max(0, ...Object.values(poids));
  return max > 0 ? (poids[cle] ?? 0) / max : 0;
}
