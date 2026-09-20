import { Screen } from "@/components/ui/Screen";
import { ClientNav } from "@/components/nav/ClientNav";
import { createClient } from "@/lib/supabase/server";
import { getMyProfile } from "@/lib/data/session";
import { countUnreadMessages } from "@/lib/data/messages";

/**
 * Le cadre des écrans CLIENT qui portent la barre d'onglets.
 *
 * PAS DE GARDE ICI, ET C'EST VOULU : le catalogue est PUBLIC (`/`,
 * `/recherche`, `/boutique/[id]` se lisent sans compte), contrairement au
 * pendant commerçant qui refuse l'entrée. Les deux écrans qui exigent un
 * compte se gardent eux-mêmes — `/messages` par `requireClientSpace`,
 * `/compte` par `clientSpaceFallback`.
 *
 * Le compteur n'est demandé qu'aux personnes connectées :
 * `countUnreadMessages` interroge la base, et la déclencher pour chaque
 * visiteur anonyme coûterait une requête par page vue (docs/PERFORMANCE.md).
 */
export default async function ClientTabsLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const profile = await getMyProfile(supabase, "client");
  const unreadCount = profile ? await countUnreadMessages(supabase, "client") : 0;

  return (
    <Screen>
      {children}
      <ClientNav unreadCount={unreadCount} />
    </Screen>
  );
}
