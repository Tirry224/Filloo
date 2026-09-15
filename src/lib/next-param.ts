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
 * La règle est donc une liste blanche de FORME : un seul slash au
 * début, rien d'autre. Ce qui écarte `https://…` (autre site),
 * `//autre.gn/x` (même chose, écrite en abrégé), `\\autre.gn` (que
 * certains navigateurs lisent comme `//`) et toute adresse relative qui
 * dépendrait de la page courante.
 */
export function safeNextPath(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const next = value.trim();
  if (!next.startsWith("/")) return null;
  if (next.startsWith("//") || next.startsWith("/\\")) return null;
  return next;
}
