/**
 * La vérification est CÔTÉ SERVEUR, seul endroit où elle garantit quelque
 * chose : les formulaires marchent sans JavaScript (docs/PERFORMANCE.md,
 * R7) et une requête forgée ne passe par aucun champ.
 */

/** Longueur minimale, à un seul endroit : Supabase impose 6 par défaut, le
 *  projet en demande 8 partout. */
export const LONGUEUR_MIN_MOT_DE_PASSE = 8;

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
