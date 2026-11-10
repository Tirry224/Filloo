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

const suite = (de: number, a: number, pas = 1) =>
  Array.from({ length: Math.floor((a - de) / pas) + 1 }, (_, i) => String(de + i * pas));

/**
 * Les tailles, rangées en GROUPES (demande du porteur du projet,
 * 2026-11-10) : un enfant se mesure à son âge, une personne de plus de
 * 15 ans en lettres (S, M, L…) ET, pour un bas (jean, pantalon, jupe), au
 * tour de taille chiffré à partir de 25 ; les pieds ont leurs pointures,
 * enfant à part. Même système pour femme et homme.
 */
export const TAILLES_BEBE = ["0-3 mois", "3-6 mois", "6-12 mois", "12-18 mois", "18-24 mois"] as const;
export const TAILLES_ENFANT = ["2 ans", "3 ans", "4 ans", "5 ans", "6 ans", "8 ans", "10 ans", "12 ans", "14 ans"] as const;
export const TAILLES_LETTRES = ["XS", "S", "M", "L", "XL", "XXL", "3XL", "4XL"] as const;
/** Tour de taille des jeans et pantalons : 25 à 40, puis de deux en deux jusqu'à 46. */
export const TAILLES_CHIFFREES: readonly string[] = [...suite(25, 40), ...suite(42, 46, 2)];
export const POINTURES_ENFANT: readonly string[] = suite(18, 34);
export const POINTURES: readonly string[] = suite(35, 47);

/** Les catégories où l'on donne aussi un tour de taille chiffré (slugs, 0074). */
const BAS = new Set(["pantalons", "jupes", "ensembles", "tenues-sport"]);

export type GroupeTailles = { titre: string; tailles: readonly string[] };

/**
 * Les groupes de tailles à proposer pour un article, d'après son rayon,
 * sa catégorie et pour qui il est. Sans genre choisi, ce sont les tailles
 * adultes : le cas le plus courant.
 */
export function groupesDeTailles(famille: Famille, genre: string | null | undefined, slug?: string | null): GroupeTailles[] {
  const enfant = genre === "enfant";
  if (famille === "accessoires") return [{ titre: "Taille", tailles: [TAILLE_UNIQUE] }];
  if (famille === "chaussures") {
    return enfant
      ? [{ titre: "Pointures enfant", tailles: POINTURES_ENFANT }]
      : [{ titre: "Pointures", tailles: POINTURES }];
  }
  if (enfant) {
    return [
      { titre: "Bébé", tailles: TAILLES_BEBE },
      { titre: "Enfant (par âge)", tailles: TAILLES_ENFANT },
      { titre: "Autre", tailles: [TAILLE_UNIQUE] },
    ];
  }
  return [
    { titre: "Tailles (S, M, L…)", tailles: TAILLES_LETTRES },
    ...(slug && BAS.has(slug) ? [{ titre: "Tour de taille (jeans, pantalons)", tailles: TAILLES_CHIFFREES }] : []),
    { titre: "Autre", tailles: [TAILLE_UNIQUE] },
  ];
}

/** Les tailles d'une liste de groupes, à plat et sans doublon. */
export function aPlat(groupes: readonly GroupeTailles[]): string[] {
  return [...new Set(groupes.flatMap((g) => g.tailles))];
}

/** Toutes les tailles permises : la liste que le serveur accepte. */
export const TOUTES_TAILLES: readonly string[] = aPlat([
  { titre: "", tailles: TAILLES_BEBE },
  { titre: "", tailles: TAILLES_ENFANT },
  { titre: "", tailles: TAILLES_LETTRES },
  { titre: "", tailles: TAILLES_CHIFFREES },
  { titre: "", tailles: POINTURES_ENFANT },
  { titre: "", tailles: POINTURES },
  { titre: "", tailles: [TAILLE_UNIQUE] },
]);

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
export const TAILLES_MAX = 40;

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
