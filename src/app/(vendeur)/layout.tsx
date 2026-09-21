import { createClient } from "@/lib/supabase/server";
import { requireMerchantSpace } from "@/lib/data/session";

/**
 * La frontière de l'espace COMMERÇANT.
 *
 * Ce fichier ne dessine rien : personne n'entre dans `/vendeur/*` sans
 * profil commerçant, quelle que soit la façon dont l'URL a été obtenue.
 * Un layout et non un contrôle par écran, parce que c'est le seul point de
 * passage qu'une route enfant ne peut pas contourner : l'écran suivant
 * sera protégé sans que son auteur y pense.
 *
 * Ça ne remplace pas le RLS et ne le double pas : le RLS décide quelles
 * LIGNES une requête rapporte, ce layout quels ÉCRANS existent pour qui.
 * Sans lui, un client authentifié atteint une feuille d'actions vide mais
 * habillée en commerçant — aucune donnée ne fuit, l'application est
 * cassée quand même.
 *
 * Le contrôle au bord (`src/middleware.ts`) arrive avant, mais ne connaît
 * que la présence d'une session ; la décision de rôle se prend ici, où la
 * base est joignable.
 */
export default async function MerchantSpaceLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  await requireMerchantSpace(supabase);

  return <>{children}</>;
}
