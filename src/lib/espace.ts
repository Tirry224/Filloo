export type Espace = "client" | "merchant";

export function messagesBase(espace: Espace): string {
  return espace === "merchant" ? "/vendeur/messages" : "/messages";
}
