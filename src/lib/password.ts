/**
 * La règle d'un mot de passe qu'on CRÉE ou qu'on change, écrite une fois.
 *
 * UN FICHIER POUR DEUX CONDITIONS : trois écrans créent ou modifient un mot
 * de passe (inscription, réinitialisation par email, modification de la
 * boutique). Recopiées, ces règles divergeraient — le jour où la longueur
 * minimale change, on en corrigerait deux sur trois. Le projet a déjà payé
 * cette leçon : sept gardes recopiées dans `/vendeur`, la huitième oubliée.
 *
 * LA VÉRIFICATION EST CÔTÉ SERVEUR parce qu'elle seule est une garantie :
 * les formulaires doivent fonctionner SANS JavaScript (docs/PERFORMANCE.md,
 * règle R7) et une requête forgée ne passe par aucun champ. Le contrôle du
 * navigateur, quand il existe, ne fait que l'annoncer plus tôt.
 */

/** Longueur minimale, à un seul endroit : Supabase impose 6 par défaut, le
 *  projet en demande 8 partout. */
export const LONGUEUR_MIN_MOT_DE_PASSE = 8;

/**
 * `null` = mot de passe acceptable. Une chaîne = le message à afficher tel
 * quel. La LONGUEUR est contrôlée d'abord : sinon, qui tape « 1234 » deux
 * fois s'entend dire que ses saisies correspondent, puis au coup suivant
 * qu'elles sont trop courtes — deux allers-retours pour un seul défaut.
 */
export function erreurNouveauMotDePasse(motDePasse: string, confirmation: string): string | null {
  if (motDePasse.length < LONGUEUR_MIN_MOT_DE_PASSE) {
    return `${LONGUEUR_MIN_MOT_DE_PASSE} caractères minimum pour le mot de passe.`;
  }
  /* Comparaison stricte, sans `trim` : pour Supabase une espace de bord
     FAIT PARTIE du mot de passe. La rogner ici ferait accepter une paire
     qui ne s'ouvrira pas à la connexion suivante. */
  if (motDePasse !== confirmation) {
    return "Les deux mots de passe ne correspondent pas.";
  }
  return null;
}
