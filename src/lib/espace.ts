/**
 * Les deux espaces de Makiti, et l'adresse de leur messagerie.
 *
 * L'espace est porté par le CHEMIN (`/messages`, `/vendeur/messages`) :
 * deux routes dans deux groupes, derrière deux layouts. Il l'était avant
 * par une query string (`?vue=commercant`), que `redirect`, favori, lien
 * partagé ou retour arrière perdaient — et un commerçant se retrouvait
 * dans sa boîte d'acheteur. Centraliser la fabrication du paramètre n'y
 * changeait rien : la fonction ci-dessous ne rattrape plus rien, elle
 * nomme une constante.
 */
export type Espace = "client" | "merchant";

/** La racine de la messagerie de cet espace. Les fils et leurs feuilles
 *  s'y accrochent : `${messagesBase(e)}/${id}`, `/citer`, `/signaler`. */
export function messagesBase(espace: Espace): string {
  return espace === "merchant" ? "/vendeur/messages" : "/messages";
}
