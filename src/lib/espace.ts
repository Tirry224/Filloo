/**
 * Les deux espaces de Makiti, et l'adresse de leur messagerie.
 *
 * CE FICHIER REMPLACE `src/lib/space.ts`, ET LE REMPLACE EN FAISANT MOINS
 * L'ancien exportait `messagesHref(space)`, qui fabriquait
 * `/messages?vue=commercant`. Il avait été écrit pour une bonne raison —
 * ce paramètre était recopié à la main et se perdait d'un écran à
 * l'autre, envoyant un commerçant dans sa boîte d'acheteur. Mais
 * centraliser la fabrication d'un paramètre fragile ne le rend pas
 * solide : ça garantit seulement qu'il est écrit pareil partout où l'on a
 * pensé à appeler la fonction. Un `redirect` qui ne repropage pas la
 * query string, un favori, un lien partagé, un retour arrière — et
 * l'espace changeait sous les pieds de la personne.
 *
 * L'espace est maintenant porté par le CHEMIN, qui ne se perd pas :
 *
 *     client     → /messages
 *     commerçant → /vendeur/messages
 *
 * Ce ne sont plus deux vues d'une même route, ce sont deux routes, dans
 * deux groupes, derrière deux layouts. La fonction ci-dessous ne
 * rattrape donc plus rien : elle ne fait que nommer une constante, et
 * c'est précisément pour ça qu'on peut lui faire confiance.
 */
export type Espace = "client" | "merchant";

/** La racine de la messagerie de cet espace. Les fils et leurs feuilles
 *  s'y accrochent : `${messagesBase(e)}/${id}`, `/citer`, `/signaler`. */
export function messagesBase(espace: Espace): string {
  return espace === "merchant" ? "/vendeur/messages" : "/messages";
}
