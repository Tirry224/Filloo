/**
 * Les deux espaces de Makiti, et l'adresse de leur messagerie.
 *
 * L'espace est porté par le CHEMIN (`/messages`, `/vendeur/messages`) :
 * deux routes dans deux groupes, derrière deux layouts. Une query string
 * (`?vue=commercant`) se perdait au `redirect`, au favori ou au retour
 * arrière, et renvoyait un commerçant dans sa boîte d'acheteur.
 */
export type Espace = "client" | "merchant";

/** La racine de la messagerie de cet espace. Les fils et leurs feuilles
 *  s'y accrochent : `${messagesBase(e)}/${id}`, `/citer`, `/signaler`. */
export function messagesBase(espace: Espace): string {
  return espace === "merchant" ? "/vendeur/messages" : "/messages";
}
