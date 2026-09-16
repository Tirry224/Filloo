import { Screen } from "@/components/ui/Screen";
import { MerchantNav } from "@/components/nav/MerchantNav";
import { createClient } from "@/lib/supabase/server";
import { countUnreadMessages } from "@/lib/data/messages";

/**
 * Le cadre des écrans de `/vendeur` qui portent la barre d'onglets.
 *
 * LA BARRE EST RENDUE ICI, PLUS JAMAIS PAR UN ÉCRAN
 * C'est le cœur de la correction. Avant, chaque écran rendait lui-même sa
 * barre et lui passait `space="merchant"` ; la valeur par défaut étant
 * « client », tout écran qui oubliait la prop servait la navigation de
 * l'autre espace sans que rien ne le signale. Ici, un écran de ce groupe
 * ne PEUT pas se tromper de barre : il ne la rend pas.
 *
 * Le compteur de non-lus est compté une fois, ici, pour l'espace
 * commerçant uniquement (`countUnreadMessages(supabase, "merchant")`).
 * Chaque écran le refaisait de son côté, avec le risque d'y mettre
 * « client » par distraction — un commerçant aurait alors vu le badge de
 * ses achats sur l'onglet de ses ventes.
 *
 * POURQUOI DEUX GROUPES DANS `(vendeur)` PLUTÔT QU'UN
 * `(plein-ecran)` tient les feuilles d'actions et les formulaires
 * produit : des écrans qu'on ouvre PAR-DESSUS la boutique et qu'on ferme,
 * pas des destinations. Leur donner la barre d'onglets proposerait de
 * partir ailleurs au milieu d'un formulaire à moitié rempli. Les deux
 * groupes partagent la garde de `(vendeur)/layout.tsx` — la séparation
 * porte sur l'habillage, jamais sur la sécurité.
 */
export default async function MerchantTabsLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const unreadCount = await countUnreadMessages(supabase, "merchant");

  return (
    <Screen>
      {children}
      <MerchantNav unreadCount={unreadCount} />
    </Screen>
  );
}
