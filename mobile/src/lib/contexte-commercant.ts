import { createContext, useContext } from "react";
import type { CompteCommercant } from "./vendeur";

type Contexte = { compte: CompteCommercant; recharger: () => Promise<void> };

export const ContexteCommercant = createContext<Contexte | null>(null);

/** Le compte commerçant actif de la connexion, fourni par `app/vendeur/_layout.tsx`. */
export function useCommercant(): Contexte {
  const c = useContext(ContexteCommercant);
  if (!c) throw new Error("useCommercant hors de l'espace commerçant");
  return c;
}
