/**
 * L'adresse où reprendre après une connexion ou une inscription.
 *
 * Le seul écran de l'application qui exige un compte est « Contacter le
 * vendeur » (écran 16). Jusqu'ici, la personne y touchait « Créer mon
 * compte », s'inscrivait… et atterrissait sur le fil d'accueil : le
 * produit qu'elle voulait acheter avait disparu en chemin, et il lui
 * fallait le retrouver à la main pour recommencer. On demande un compte
 * au moment précis où quelqu'un veut écrire à un vendeur — c'est le
 * geste le plus précieux du produit, et c'est celui qu'on lui faisait
 * perdre.
 *
 * L'intention voyage donc dans `?next=`, d'écran en écran, jusqu'à
 * l'action serveur qui conclut l'authentification.
 *
 * `safeNextPath` est ce qui rend ce paramètre sûr. Il vient de l'URL,
 * donc de n'importe qui : un lien `…/connexion?next=https://faux-makiti.gn`
 * envoyé sur WhatsApp ferait rebondir la victime vers un site
 * d'hameçonnage APRÈS une connexion réussie — elle n'aurait aucune
 * raison de se méfier. C'est la faille dite « redirection ouverte ».
 *
 * POURQUOI LA PREMIÈRE VERSION NE SUFFISAIT PAS
 * Elle testait des PRÉFIXES : commence par `/`, mais pas par `//` ni
 * `/\`. Audit du 2026-09-15, mesuré : `/⇥/faux-makiti.gn` — une
 * tabulation glissée en deuxième position — passait le filtre, et Node
 * émet l'en-tête `Location` avec la tabulation intacte (vérifié sur un
 * serveur de test). Or la spécification URL impose aux navigateurs de
 * SUPPRIMER tabulations, retours chariot et sauts de ligne avant
 * d'analyser une adresse : `/⇥/faux-makiti.gn` redevient
 * `//faux-makiti.gn`, c'est-à-dire l'autre domaine, écrit en abrégé.
 * Même tour avec `\n` et `\r`.
 *
 * La leçon est générale et vaut au-delà de ce fichier : une liste
 * blanche qui compare des préfixes valide une ORTHOGRAPHE, pas une
 * adresse. Elle ne peut pas voir ce que le navigateur fera du texte
 * ensuite. Il faut analyser la chaîne comme une URL — exactement comme
 * celui qui la suivra.
 *
 * La règle est donc en trois temps :
 *   1. un seul slash au début, sinon rien à discuter ;
 *   2. aucun caractère de contrôle, puisque le navigateur en efface
 *      trois et change ainsi le sens de l'adresse ;
 *   3. résolue contre une origine qui n'existe pas, l'adresse doit
 *      RESTER sur cette origine. C'est ce qui écarte `//autre.gn/x`,
 *      `/\autre.gn` (l'antislash vaut un slash pour l'analyseur) et
 *      tout ce qu'on n'a pas encore imaginé.
 *
 * `makiti.invalid` : le domaine de premier niveau `.invalid` est
 * réservé par la RFC 2606 et ne peut être enregistré par personne. Rien
 * n'est joint, c'est une analyse de chaîne — mais si un jour cette
 * valeur fuitait dans une requête, elle ne mènerait nulle part.
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
