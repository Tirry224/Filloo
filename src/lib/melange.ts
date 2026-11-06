import { affinite, type Gouts } from "./gouts.ts";

/**
 * L'ordre de l'accueil (décision du porteur du projet, 2026-11-06) : plus
 * de liste par date de publication, qui donnait toujours la tête aux mêmes
 * produits. À chaque affichage, un tirage :
 *
 * - au hasard, pour que chaque produit ait sa chance et que l'accueil
 *   change à chaque visite ;
 * - pondéré par les goûts de l'appareil (`gouts.ts`) : une catégorie ou une
 *   boutique souvent regardée sort plus souvent en tête, sans jamais
 *   chasser les autres (poids au plus ×5, jamais exclusif) ;
 * - puis étalé : deux produits de la même boutique ne se suivent pas
 *   tant qu'on peut l'éviter, pour qu'une boutique à cinquante produits ne
 *   couvre pas l'écran.
 *
 * Les produits vendus restent visibles, mais loin derrière.
 */

type Melangeable = {
  id: string;
  category: string;
  status: string;
  merchant: { id: string };
};

/** Un tirage injectable pour les tests ; `Math.random` sinon. */
export type Hasard = () => number;

const POIDS_CATEGORIE = 3;
const POIDS_BOUTIQUE = 1;
const POIDS_VENDU = 0.15;

export function poids(p: Melangeable, gouts: Gouts): number {
  const base = 1 + POIDS_CATEGORIE * affinite(gouts.c, p.category) + POIDS_BOUTIQUE * affinite(gouts.b, p.merchant.id);
  return p.status === "sold" ? base * POIDS_VENDU : base;
}

/**
 * Tirage pondéré sans remise (Efraimidis–Spirakis) : chaque produit reçoit
 * la clé `u^(1/poids)`, on trie par clé décroissante. Un poids double donne
 * deux fois plus de chances d'être devant, en une seule passe.
 */
export function melanger<T extends Melangeable>(produits: readonly T[], gouts: Gouts, hasard: Hasard = Math.random): T[] {
  const tires = produits
    .map((p) => ({ p, cle: Math.pow(Math.max(hasard(), Number.EPSILON), 1 / poids(p, gouts)) }))
    .sort((a, b) => b.cle - a.cle)
    .map(({ p }) => p);
  return etaler(tires);
}

/** Deux produits d'une même boutique ne se suivent pas, si un autre peut s'intercaler. */
export function etaler<T extends Melangeable>(liste: readonly T[]): T[] {
  const reste = [...liste];
  const sortie: T[] = [];
  while (reste.length) {
    const precedente = sortie.at(-1)?.merchant.id;
    const i = reste.findIndex((p) => p.merchant.id !== precedente);
    sortie.push(reste.splice(i === -1 ? 0 : i, 1)[0]);
  }
  return sortie;
}

/**
 * « Vous aimerez aussi » sous une fiche : surtout la même catégorie, un peu
 * d'ailleurs, jamais le produit lui-même. Les goûts de l'appareil départagent.
 */
export function suggestions<T extends Melangeable>(
  produits: readonly T[],
  fiche: { id: string; category: string },
  gouts: Gouts,
  nombre = 6,
  hasard: Hasard = Math.random,
): T[] {
  const autres = produits.filter((p) => p.id !== fiche.id && p.status !== "sold");
  const proches = melanger(autres.filter((p) => p.category === fiche.category), gouts, hasard);
  const ailleurs = melanger(autres.filter((p) => p.category !== fiche.category), gouts, hasard);
  // Deux tiers de la même catégorie quand il y en a assez, le reste pour la découverte.
  const nbProches = Math.min(proches.length, Math.ceil((nombre * 2) / 3));
  return [...proches.slice(0, nbProches), ...ailleurs].slice(0, nombre);
}

/** Les catégories souvent regardées d'abord ; les autres gardent leur ordre, pour qu'on s'y retrouve. */
export function categoriesParGouts<C extends { name: string }>(categories: readonly C[], gouts: Gouts): C[] {
  return [...categories].sort((a, b) => (gouts.c[b.name] ?? 0) - (gouts.c[a.name] ?? 0));
}
