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
