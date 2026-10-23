/**
 * La vérification est CÔTÉ SERVEUR, seul endroit où elle garantit quelque
 * chose : les formulaires marchent sans JavaScript (docs/PERFORMANCE.md,
 * R7) et une requête forgée ne passe par aucun champ.
 */

/** Longueur minimale, à un seul endroit, et ÉGALE au réglage de Supabase
 *  (Authentication → Sign In / Providers → Email). Constaté à 10 dans les
 *  journaux d'authentification le 2026-10-22, alors qu'elle valait 8 ici :
 *  un mot de passe de 8 ou 9 caractères passait le site puis se faisait
 *  refuser par Supabase. Changer l'un, c'est changer l'autre. */
export const LONGUEUR_MIN_MOT_DE_PASSE = 10;

export function erreurNouveauMotDePasse(motDePasse: string, confirmation: string): string | null {
  if (motDePasse.length < LONGUEUR_MIN_MOT_DE_PASSE) {
    return `${LONGUEUR_MIN_MOT_DE_PASSE} caractères minimum pour le mot de passe.`;
  }
  // Sans `trim` : pour Supabase une espace de bord FAIT PARTIE du mot de
  // passe, la rogner ici accepterait une paire qui n'ouvrira rien.
  if (motDePasse !== confirmation) {
    return "Les deux mots de passe ne correspondent pas.";
  }
  return null;
}
