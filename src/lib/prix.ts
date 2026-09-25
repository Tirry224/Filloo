/**
 * Lire un prix tapé par un commerçant, en francs guinéens ENTIERS.
 *
 * `Number()` ne convient pas : il lit « 450.000 » comme 450 — le point
 * étant ici un séparateur de milliers courant, le prix était divisé par
 * mille sans un mot —, refuse « 450 000 », pourtant l'exemple affiché
 * dans le champ, et accepte « », « 1e6 » ou « 0x1F4 ». La règle est donc
 * écrite à la main : des chiffres, éventuellement groupés par trois.
 *
 * À appliquer CÔTÉ SERVEUR : une requête forgée ne passe par aucun
 * `inputMode` HTML.
 */

const EXEMPLE = "exemple : 450 000";

/** Dix milliards de francs : un terrain, un camion. Au-delà, c'est une
 * touche restée appuyée — et le montant débordait de la fiche produit. */
export const PRIX_MAX_GNF = 10_000_000_000;

/** Groupes de trois séparés par UN SEUL et même signe : « 1.500.000 » ou
 * « 1,500,000 », jamais « 1.500,000 », qui ressemble à un décimal. */
const MILLIERS_GROUPES = /^\d{1,3}(?:([.,])\d{3})(?:\1\d{3})*$/;

export function lirePrixGnf(saisie: string): { prix: number } | { erreur: string } {
  const texte = saisie
    // `\s` couvre aussi l'insécable et l'espace fine que colle un
    // montant copié depuis un affichage `formatGnf`.
    .replace(/\s+/g, "")
    // L'unité tapée par habitude : « 450 000 GNF », « 450000 FG ».
    .replace(/(gnf|fg)$/i, "");

  if (!texte) return { erreur: "Indiquez le prix." };

  let chiffres: string;
  if (/^\d+$/.test(texte)) {
    chiffres = texte;
  } else if (MILLIERS_GROUPES.test(texte)) {
    chiffres = texte.replace(/[.,]/g, "");
  } else if (/^[\d.,]+$/.test(texte)) {
    return { erreur: `Le prix s'écrit en francs entiers, sans virgule (${EXEMPLE}).` };
  } else {
    return { erreur: `Le prix ne doit contenir que des chiffres (${EXEMPLE}).` };
  }

  const prix = Number(chiffres);
  // Au-delà, `Number` arrondit déjà : le montant enregistré ne serait plus
  // celui qui a été tapé.
  if (!Number.isSafeInteger(prix) || prix > PRIX_MAX_GNF) {
    return { erreur: "Ce prix est trop grand : 10 000 000 000 GNF au maximum." };
  }
  return { prix };
}
