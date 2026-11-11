import type { User } from "@supabase/supabase-js";

/**
 * La vérification est CÔTÉ SERVEUR, seul endroit où elle garantit quelque
 * chose : les formulaires marchent sans JavaScript (docs/PERFORMANCE.md,
 * R7) et une requête forgée ne passe par aucun champ.
 */

/** Longueur minimale, à un seul endroit, et ÉGALE au réglage de Supabase
 *  (Authentication → Sign In / Providers → Email). Le 2026-10-22, Supabase
 *  exigeait 10 et le site 8 : un mot de passe de 8 ou 9 caractères passait
 *  le site puis se faisait refuser. Le porteur du projet a remis Supabase
 *  à 8 le 2026-10-23. Changer l'un, c'est changer l'autre. */
export const LONGUEUR_MIN_MOT_DE_PASSE = 8;

export function erreurNouveauMotDePasse(motDePasse: string, confirmation: string): string | null {
  if (motDePasse.length < LONGUEUR_MIN_MOT_DE_PASSE) {
    return `Mot de passe trop court : ${LONGUEUR_MIN_MOT_DE_PASSE} caractères minimum, dont un chiffre.`;
  }
  /* Au moins un chiffre, pas seulement des lettres (décision du porteur
     du projet, 2026-10-23). Le site l'exige ; Supabase ne l'exige que si
     son réglage « Password requirements » le demande aussi. */
  if (!/\d/.test(motDePasse)) {
    return "Ajoutez au moins un chiffre au mot de passe.";
  }
  // Sans `trim` : pour Supabase une espace de bord FAIT PARTIE du mot de
  // passe, la rogner ici accepterait une paire qui n'ouvrira rien.
  if (motDePasse !== confirmation) {
    return "Les deux mots de passe sont différents.";
  }
  return null;
}

/** Un compte créé avec Google n'a AUCUN mot de passe (constaté en base le
 *  2026-11-11 : 0 sur 3) : « Modifier mon mot de passe », qui exige
 *  l'actuel, ne peut que l'égarer. Faute d'information, on suppose un mot
 *  de passe : mieux vaut un formulaire de trop qu'un compte sans moyen
 *  d'en changer. */
export function aUnMotDePasse(user: Pick<User, "app_metadata"> | null): boolean {
  /* Posé par `createMyPasswordAction` (clé `service_role`, la personne ne
     peut pas l'écrire) : un compte Google qui s'est créé un mot de passe
     garde « google » seul dans ses fournisseurs. */
  if (user?.app_metadata?.mot_de_passe_cree === true) return true;
  const fournisseurs = user?.app_metadata?.providers;
  if (!Array.isArray(fournisseurs) || fournisseurs.length === 0) return true;
  return fournisseurs.includes("email");
}

/** Délai pendant lequel une connexion Google vaut preuve d'identité pour
 *  CRÉER un mot de passe. Un compte Google n'a pas de mot de passe actuel
 *  à demander : sans cette preuve, un téléphone emprunté trente secondes
 *  suffirait à en poser un, puis à entrer plus tard sans Google. */
export const DELAI_PREUVE_GOOGLE_S = 10 * 60;

/** Vrai si la session vient d'une connexion Google faite il y a moins de
 *  `DELAI_PREUVE_GOOGLE_S`. `amr` vient du jeton signé ; son horodatage
 *  est celui de la connexion, pas du dernier rafraîchissement. */
export function connexionGoogleRecente(amr: unknown, maintenantS: number): boolean {
  if (!Array.isArray(amr)) return false;
  return amr.some(
    (entree) =>
      typeof entree === "object" &&
      entree !== null &&
      (entree as { method?: unknown }).method === "oauth" &&
      typeof (entree as { timestamp?: unknown }).timestamp === "number" &&
      maintenantS - (entree as { timestamp: number }).timestamp <= DELAI_PREUVE_GOOGLE_S,
  );
}
