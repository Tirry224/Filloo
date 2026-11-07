/**
 * Recherche dans une liste déjà lue (boîte de l'équipe, publicité) : sans
 * accents ni majuscules, comme les recherches de la base (0063). Ces listes
 * sont lues en entier par leur page : filtrer ici évite une fonction de
 * base de plus.
 */
export function normaliser(texte: string): string {
  return texte.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}

/** Vrai si l'un des textes contient la recherche (déjà nettoyée par `lireRecherche`). */
export function correspond(recherche: string, ...textes: (string | null | undefined)[]): boolean {
  const q = normaliser(recherche);
  return textes.some((t) => t != null && normaliser(t).includes(q));
}
