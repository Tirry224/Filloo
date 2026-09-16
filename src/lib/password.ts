/**
 * La règle d'un mot de passe qu'on CRÉE ou qu'on change, écrite une fois.
 *
 * POURQUOI UN FICHIER POUR DEUX CONDITIONS
 * Trois écrans créent ou modifient un mot de passe — l'inscription, la
 * réinitialisation par email, et la modification de la boutique. Recopier
 * « 8 caractères minimum » et « les deux saisies doivent correspondre »
 * dans trois actions, c'est trois occasions de les faire diverger : le
 * jour où la longueur minimale change, on en corrigera deux sur trois, et
 * le troisième écran acceptera en silence ce que les autres refusent.
 *
 * C'est la leçon que ce projet a déjà payée ailleurs — sept gardes
 * recopiées dans les écrans `/vendeur`, dont la huitième manquait.
 *
 * POURQUOI LA VÉRIFICATION EST CÔTÉ SERVEUR
 * Le navigateur peut comparer les deux champs, et c'est confortable. Mais
 * ce confort n'est pas une garantie : les formulaires de Makiti doivent
 * fonctionner SANS JavaScript (docs/PERFORMANCE.md, règle R7 — c'est
 * l'état d'une connexion guinéenne pendant les premières secondes), et
 * une requête forgée ne passe par aucun champ. La seule vérification qui
 * compte est donc celle qui a lieu ici, dans l'action serveur. Celle du
 * navigateur, quand elle existe, ne fait que l'annoncer plus tôt.
 */

/** Longueur minimale, à un seul endroit. Supabase impose 6 par défaut ;
 *  le projet en demande 8 depuis l'écran d'inscription, et cette valeur
 *  est ce qui le rend vrai partout. */
export const LONGUEUR_MIN_MOT_DE_PASSE = 8;

/**
 * `null` = le mot de passe est acceptable. Une chaîne = le message à
 * afficher, déjà écrit en français pour être lu tel quel.
 *
 * L'ordre des deux contrôles n'est pas indifférent : on parle de la
 * LONGUEUR d'abord. Quelqu'un qui tape « 1234 » deux fois de suite
 * s'entendrait sinon dire que ses saisies correspondent bien, avant
 * d'apprendre au coup suivant qu'elles étaient trop courtes — deux
 * allers-retours pour un seul défaut.
 */
export function erreurNouveauMotDePasse(motDePasse: string, confirmation: string): string | null {
  if (motDePasse.length < LONGUEUR_MIN_MOT_DE_PASSE) {
    return `${LONGUEUR_MIN_MOT_DE_PASSE} caractères minimum pour le mot de passe.`;
  }
  /* Comparaison stricte, sans `trim` : une espace au début ou à la fin
     FAIT PARTIE du mot de passe pour Supabase, donc deux saisies qui ne
     diffèrent que par elle sont réellement différentes. Les rogner ici
     ferait accepter une paire qui ne s'ouvrira pas à la connexion
     suivante — le pire moment pour découvrir l'écart. */
  if (motDePasse !== confirmation) {
    return "Les deux mots de passe ne correspondent pas.";
  }
  return null;
}
