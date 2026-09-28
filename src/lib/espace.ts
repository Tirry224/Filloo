export type Espace = "client" | "merchant";

/** Le dernier espace affiché (`EspaceMemo`), lu à l'ouverture de l'app. */
export const ESPACE_COOKIE = "filloo-espace";

export function messagesBase(espace: Espace): string {
  return espace === "merchant" ? "/vendeur/messages" : "/messages";
}
