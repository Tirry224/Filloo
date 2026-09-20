import { createClient } from "@/lib/supabase/server";
import { requireMerchantSpace } from "@/lib/data/session";

/**
 * La frontière de l'espace COMMERÇANT.
 *
 * Ce fichier ne dessine rien : personne n'entre dans `/vendeur/*` sans
 * profil commerçant, quelle que soit la façon dont l'URL a été obtenue —
 * lien, favori, historique, ou adresse tapée à la main.
 *
 * UN LAYOUT ET PAS UNE VÉRIFICATION PAR ÉCRAN : c'est le seul point de
 * passage qu'une route enfant ne peut pas contourner. Les sept écrans de
 * cet espace refaisaient chacun leur contrôle, le huitième ne l'avait pas.
 * L'écran suivant sera protégé sans que son auteur y pense.
 *
 * ÇA NE REMPLACE PAS LE RLS, et ça ne le double pas : le RLS décide quelles
 * LIGNES une requête rapporte, et resterait seul maître si quelqu'un
 * appelait l'API de Supabase sans passer par l'application. Ce layout
 * décide quels ÉCRANS existent pour qui — il protège le PARCOURS. Sans
 * lui, un client authentifié atteignait la feuille d'actions d'un produit :
 * vide grâce au RLS, mais habillée en commerçant. Aucune donnée ne fuyait,
 * et l'application était quand même cassée.
 *
 * Le contrôle au bord (`src/middleware.ts`) arrive avant et refuse les
 * anonymes sans interroger la base ; il ne connaît que la présence d'une
 * session, pas les rôles. La décision de rôle se prend ici, où la base est
 * joignable.
 */
export default async function MerchantSpaceLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  await requireMerchantSpace(supabase);

  return <>{children}</>;
}
