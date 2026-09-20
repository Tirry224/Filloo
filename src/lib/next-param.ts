/**
 * L'adresse où reprendre après une connexion ou une inscription.
 *
 * Le seul écran qui exige un compte est « Contacter le vendeur » (16). Sans
 * `?next=`, la personne s'inscrivait et atterrissait sur le fil d'accueil :
 * le produit qu'elle voulait acheter avait disparu en chemin. On demande un
 * compte au moment du geste le plus précieux du produit, et c'était celui-là
 * qu'on lui faisait perdre.
 *
 * CE PARAMÈTRE VIENT DE L'URL, DONC DE N'IMPORTE QUI. Un lien
 * `…/connexion?next=https://faux-makiti.gn` envoyé sur WhatsApp ferait
 * rebondir la victime vers un site d'hameçonnage APRÈS une connexion
 * réussie, sans aucune raison de se méfier : c'est la redirection ouverte.
 *
 * POURQUOI UNE COMPARAISON DE PRÉFIXES NE SUFFIT PAS — mesuré le
 * 2026-09-15. La première version testait « commence par `/`, mais pas par
 * `//` ni `/\` ». Or `/⇥/faux-makiti.gn`, une TABULATION en deuxième
 * position, passait le filtre : Node émet l'en-tête `Location` tel quel, et
 * la spécification URL impose aux navigateurs de SUPPRIMER tabulations,
 * retours chariot et sauts de ligne avant d'analyser une adresse. Le chemin
 * redevient `//faux-makiti.gn`, c'est-à-dire l'autre domaine.
 *
 * La leçon dépasse ce fichier : une liste blanche qui compare des préfixes
 * valide une ORTHOGRAPHE, pas une adresse. Il faut analyser la chaîne comme
 * une URL, exactement comme celui qui la suivra.
 *
 * D'où la règle en trois temps : un seul slash au début ; aucun caractère
 * de contrôle, puisque le navigateur en efface trois et change ainsi le
 * sens de l'adresse ; et, résolue contre une origine qui n'existe pas,
 * l'adresse doit RESTER sur cette origine — ce qui écarte `//autre.gn/x`,
 * `/\autre.gn` (l'antislash vaut un slash pour l'analyseur) et tout ce
 * qu'on n'a pas encore imaginé.
 *
 * `.invalid` est réservé par la RFC 2606 : rien n'est joint, c'est une
 * analyse de chaîne, mais si cette valeur fuitait elle ne mènerait nulle
 * part.
 */
const ORIGINE_DE_TEST = "http://makiti.invalid";

/** Les trois caractères que les navigateurs effacent d'une URL, plus le
 * reste des caractères de contrôle : aucun n'a de raison d'être dans un
 * chemin, et chacun d'eux fait dire à l'adresse autre chose que ce
 * qu'elle semble dire. */
const CARACTERE_DE_CONTROLE = /[\u0000-\u001F\u007F]/;

export function safeNextPath(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const next = value.trim();
  if (!next.startsWith("/")) return null;
  if (CARACTERE_DE_CONTROLE.test(next)) return null;

  let resolue: URL;
  try {
    resolue = new URL(next, ORIGINE_DE_TEST);
  } catch {
    // Une adresse que l'analyseur refuse n'ira nulle part de bon.
    return null;
  }
  if (resolue.origin !== ORIGINE_DE_TEST) return null;

  /* La forme RÉSOLUE, pas la chaîne d'origine : `/a/../../b` devient
     `/b`, et ce qui sort d'ici est donc ce que le navigateur aurait
     compris de toute façon. On ne renvoie jamais un texte dont le sens
     resterait à interpréter. */
  return `${resolue.pathname}${resolue.search}${resolue.hash}`;
}
