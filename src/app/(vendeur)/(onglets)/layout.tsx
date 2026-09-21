import { Screen } from "@/components/ui/Screen";
import { MerchantNav } from "@/components/nav/MerchantNav";
import { createClient } from "@/lib/supabase/server";
import { countUnreadMessages } from "@/lib/data/messages";

/**
 * Le cadre des écrans de `/vendeur` qui portent la barre d'onglets.
 *
 * LA BARRE EST RENDUE ICI, jamais par un écran : un écran qui rend la
 * sienne peut se tromper de barre. Le compteur de non-lus est compté ici
 * pour la même raison — le badge des achats n'a rien à faire sur l'onglet
 * des ventes.
 *
 * `(plein-ecran)`, l'autre groupe de `(vendeur)`, n'a pas de barre : ses
 * formulaires s'ouvrent PAR-DESSUS la boutique, et une barre proposerait
 * d'en partir à moitié rempli. Les deux groupes partagent la garde de
 * `(vendeur)/layout.tsx` : la séparation porte sur l'habillage, jamais sur
 * la sécurité.
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
