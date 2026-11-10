/**
 * Le vocabulaire de la mode : genres, familles de catégories, tailles,
 * couleurs et tranches de prix. Décision du porteur du projet le
 * 2026-11-10 : Filloo ne présente plus que la mode.
 *
 * Ces listes sont la SEULE source des valeurs permises : la base (0074)
 * ne fait que borner le nombre de tailles et de couleurs, et vérifier le
 * genre. Une valeur ajoutée ici devient aussitôt saisissable et
 * filtrable ; une valeur RETIRÉE ici reste sur les produits qui la
 * portent, mais ne se filtre plus.
 */

export const GENRES = [
  { valeur: "femme", libelle: "Femme" },
  { valeur: "homme", libelle: "Homme" },
  { valeur: "enfant", libelle: "Enfant" },
  { valeur: "mixte", libelle: "Mixte" },
] as const;
export type Genre = (typeof GENRES)[number]["valeur"];

/** Les genres proposés au FILTRE : « Mixte » n'en est pas un, un produit
 * mixte sort déjà sous Femme et sous Homme (0074). */
export const GENRES_FILTRE = GENRES.filter((g) => g.valeur !== "mixte");

export function lireGenre(brut: unknown): Genre | null {
  return GENRES.find((g) => g.valeur === brut)?.valeur ?? null;
}

export function libelleGenre(genre: string | null | undefined): string | null {
  return GENRES.find((g) => g.valeur === genre)?.libelle ?? null;
}

/** Les trois rayons, dans l'ordre d'affichage (colonne `categories.famille`). */
export const FAMILLES = [
  { valeur: "vetements", libelle: "Vêtements" },
  { valeur: "chaussures", libelle: "Chaussures" },
  { valeur: "accessoires", libelle: "Accessoires" },
] as const;
export type Famille = (typeof FAMILLES)[number]["valeur"];

/** Une catégorie créée par l'équipe sans famille se range avec les vêtements. */
export function familleDe(famille: string | null | undefined): Famille {
  return FAMILLES.find((f) => f.valeur === famille)?.valeur ?? "vetements";
}

export const TAILLE_UNIQUE = "Taille unique";

/** Les tailles par rayon. « Taille unique » vaut pour tous. */
export const TAILLES: Record<Famille, readonly string[]> = {
  vetements: [
    "XS", "S", "M", "L", "XL", "XXL", "3XL",
    "0-2 ans", "3-5 ans", "6-9 ans", "10-14 ans",
    TAILLE_UNIQUE,
  ],
  chaussures: [
    "28", "30", "32", "34", "35", "36", "37", "38", "39", "40",
    "41", "42", "43", "44", "45", "46", "47",
  ],
  accessoires: [TAILLE_UNIQUE],
};

/** Toutes les tailles, sans doublon, dans l'ordre des rayons. */
export const TOUTES_TAILLES: readonly string[] = [...new Set(Object.values(TAILLES).flat())];

export const COULEURS = [
  { nom: "Noir", teinte: "#111111" },
  { nom: "Blanc", teinte: "#ffffff" },
  { nom: "Gris", teinte: "#9ca3af" },
  { nom: "Beige", teinte: "#e8d8b8" },
  { nom: "Marron", teinte: "#7c4a26" },
  { nom: "Rouge", teinte: "#d32f2f" },
  { nom: "Rose", teinte: "#f48fb1" },
  { nom: "Orange", teinte: "#f57c00" },
  { nom: "Jaune", teinte: "#fbc02d" },
  { nom: "Vert", teinte: "#388e3c" },
  { nom: "Bleu", teinte: "#1976d2" },
  { nom: "Violet", teinte: "#7b1fa2" },
  { nom: "Doré", teinte: "#c9a227" },
  { nom: "Argenté", teinte: "#c0c0c0" },
  { nom: "Multicolore", teinte: "conic-gradient(#d32f2f, #fbc02d, #388e3c, #1976d2, #7b1fa2, #d32f2f)" },
] as const;
export const NOMS_COULEURS: readonly string[] = COULEURS.map((c) => c.nom);

/** Au plus autant que la base accepte (0074). */
export const COULEURS_MAX = 20;
export const TAILLES_MAX = 25;

/** Tranches de prix du filtre, en GNF, bornes incluses. */
export const TRANCHES_PRIX = [
  { valeur: "moins-100k", libelle: "Moins de 100 000 GNF", min: null, max: 100_000 },
  { valeur: "100k-250k", libelle: "100 000 à 250 000 GNF", min: 100_000, max: 250_000 },
  { valeur: "250k-500k", libelle: "250 000 à 500 000 GNF", min: 250_000, max: 500_000 },
  { valeur: "plus-500k", libelle: "Plus de 500 000 GNF", min: 500_000, max: null },
] as const;
export type TranchePrix = (typeof TRANCHES_PRIX)[number];

export function lireTranchePrix(brut: unknown): TranchePrix | null {
  return TRANCHES_PRIX.find((t) => t.valeur === brut) ?? null;
}

/**
 * Garde les valeurs permises d'une saisie multiple, dans l'ordre de la
 * liste de référence et sans doublon. Une valeur forgée est ignorée, pas
 * enregistrée.
 */
export function garderPermises(saisies: readonly string[], permises: readonly string[]): string[] {
  const choisies = new Set(saisies);
  return permises.filter((p) => choisies.has(p));
}

/**
 * Une fiche à compléter : sans genre, taille ou couleur, l'article
 * n'apparaît dans AUCUN filtre de la recherche — c'est le cas de tout
 * produit publié avant la mode (0074). Un article vendu n'est plus à
 * compléter : il ne se cherche plus.
 */
export function ficheIncomplete(p: {
  status: string;
  genre?: string | null;
  tailles?: readonly string[];
  couleurs?: readonly string[];
}): boolean {
  if (p.status === "sold") return false;
  return !p.genre || !p.tailles?.length || !p.couleurs?.length;
}

/** Les tailles d'enfant (par âge), proposées seulement pour un article « Enfant ». */
export const TAILLES_ENFANT: readonly string[] = ["0-2 ans", "3-5 ans", "6-9 ans", "10-14 ans"];
