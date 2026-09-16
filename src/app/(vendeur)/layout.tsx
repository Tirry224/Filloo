import { createClient } from "@/lib/supabase/server";
import { requireMerchantSpace } from "@/lib/data/session";

/**
 * La frontière de l'espace COMMERÇANT.
 *
 * Ce fichier ne dessine rien. Il fait une seule chose, et c'est la plus
 * importante de cette arborescence : personne n'entre dans `/vendeur/*`
 * sans profil commerçant, quelle que soit la façon dont l'URL a été
 * obtenue — un lien, un favori, l'historique, ou l'adresse tapée à la
 * main.
 *
 * POURQUOI UN LAYOUT ET PAS UNE VÉRIFICATION PAR ÉCRAN
 * Un layout est le seul point de passage qu'une route enfant ne peut pas
 * contourner. Les sept écrans de cet espace refaisaient chacun leur
 * contrôle ; le huitième ne l'avait pas. L'écran suivant qu'on ajoutera
 * ici sera protégé sans que son auteur ait à y penser, et c'est le seul
 * genre de protection qui survit à une équipe et au temps.
 *
 * POURQUOI ÇA NE REMPLACE PAS LE RLS
 * Ça ne le remplace pas, et ça ne le double pas non plus : les deux
 * répondent à des questions différentes. Le RLS décide quelles LIGNES une
 * requête rapporte — il protège les données, et il resterait seul maître
 * si quelqu'un appelait l'API de Supabase sans passer par cette
 * application. Ce layout décide quels ÉCRANS existent pour qui — il
 * protège le PARCOURS. Sans lui, un client authentifié atteignait la
 * feuille d'actions d'un produit : vide grâce au RLS, mais habillée en
 * commerçant, avec la navigation d'un commerçant. Aucune donnée ne
 * fuyait, et l'application était quand même cassée.
 *
 * Le contrôle au bord (`src/middleware.ts`) arrive avant celui-ci et
 * refuse les visiteurs anonymes sans interroger la base. Il ne le
 * remplace pas davantage : lui ne connaît que la présence d'une session,
 * pas les rôles qu'elle porte. La décision de rôle se prend ici, où la
 * base est joignable.
 */
export default async function MerchantSpaceLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  await requireMerchantSpace(supabase);

  return <>{children}</>;
}
