import { AppShell } from "@/components/ui/AppShell";
import { InstallPrompt } from "@/components/ui/InstallPrompt";
import { MerchantNav } from "@/components/nav/MerchantNav";
import { AppBadge } from "@/components/nav/AppBadge";
import { EspaceMemo } from "@/components/nav/EspaceMemo";
import { createClient } from "@/lib/supabase/server";
import { countUnreadMessages } from "@/lib/data/messages";
import { maFormule } from "@/lib/data/abonnements";

/**
 * Les deux groupes de `(vendeur)` partagent la garde de
 * `(vendeur)/layout.tsx` : la séparation porte sur l'habillage, jamais sur
 * la sécurité.
 */
export default async function MerchantTabsLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  /* L'onglet ne compte que l'espace commerçant ; l'icône de
     l'application, elle, additionne les deux (`AppBadge`). */
  const [unreadCount, unreadClient, formule] = await Promise.all([
    countUnreadMessages(supabase, "merchant"),
    countUnreadMessages(supabase, "client"),
    /* Une panne ici ne doit pas fermer l'espace commerçant : sans formule lue, pas d'onglet Statistiques. */
    maFormule(supabase).catch(() => null),
  ]);

  return (
    <AppShell nav={<MerchantNav unreadCount={unreadCount} business={formule?.formule === "business"} />}>
      {children}
      <AppBadge count={unreadCount + unreadClient} />
      <EspaceMemo espace="merchant" />
      <InstallPrompt />
    </AppShell>
  );
}
