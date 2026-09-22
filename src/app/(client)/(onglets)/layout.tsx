import { Screen } from "@/components/ui/Screen";
import { InstallPrompt } from "@/components/ui/InstallPrompt";
import { ClientNav } from "@/components/nav/ClientNav";
import { createClient } from "@/lib/supabase/server";
import { getMyProfile } from "@/lib/data/session";
import { countUnreadMessages } from "@/lib/data/messages";

/**
 * Le cadre des écrans CLIENT qui portent la barre d'onglets.
 *
 * PAS DE GARDE ICI, et c'est voulu : le catalogue est public (`/`,
 * `/recherche`, `/boutique/[id]`), contrairement au pendant commerçant. Les
 * deux écrans qui exigent un compte se gardent eux-mêmes — `/messages` par
 * `requireClientSpace`, `/compte` par `clientSpaceFallback`.
 *
 * Le compteur n'est demandé qu'aux personnes connectées : `countUnread-
 * Messages` interroge la base, et une requête par visiteur anonyme
 * coûterait une requête par page vue (docs/PERFORMANCE.md).
 */
export default async function ClientTabsLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const profile = await getMyProfile(supabase, "client");
  const unreadCount = profile ? await countUnreadMessages(supabase, "client") : 0;

  return (
    <Screen>
      {children}
      <ClientNav unreadCount={unreadCount} />
      <InstallPrompt />
    </Screen>
  );
}
