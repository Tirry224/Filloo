import { AppShell } from "@/components/ui/AppShell";
import { InstallPrompt } from "@/components/ui/InstallPrompt";
import { ClientNav } from "@/components/nav/ClientNav";
import { AppBadge } from "@/components/nav/AppBadge";
import { EspaceMemo } from "@/components/nav/EspaceMemo";
import { createClient } from "@/lib/supabase/server";
import { getMyProfile } from "@/lib/data/session";
import { countUnreadMessages } from "@/lib/data/messages";

/**
 * PAS DE GARDE ICI, et c'est voulu : le catalogue est public (`/`,
 * `/recherche`, `/boutique/[id]`), contrairement au pendant commerçant. Les
 * deux écrans qui exigent un compte se gardent eux-mêmes — `/messages` par
 * `requireClientSpace`, `/compte` par `clientSpaceFallback`.
 */
export default async function ClientTabsLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const profile = await getMyProfile(supabase, "client");
  /* L'onglet ne compte que l'espace client ; l'icône de l'application,
     elle, additionne les deux (`AppBadge`). */
  const [unreadCount, unreadMerchant] = profile
    ? await Promise.all([countUnreadMessages(supabase, "client"), countUnreadMessages(supabase, "merchant")])
    : [0, 0];

  return (
    <AppShell nav={<ClientNav unreadCount={unreadCount} />}>
      {children}
      <AppBadge count={unreadCount + unreadMerchant} />
      {profile ? <EspaceMemo espace="client" /> : null}
      <InstallPrompt />
    </AppShell>
  );
}
