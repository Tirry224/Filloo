import { AppShell } from "@/components/ui/AppShell";
import { InstallPrompt } from "@/components/ui/InstallPrompt";
import { MerchantNav } from "@/components/nav/MerchantNav";
import { createClient } from "@/lib/supabase/server";
import { countUnreadMessages } from "@/lib/data/messages";

/**
 * Les deux groupes de `(vendeur)` partagent la garde de
 * `(vendeur)/layout.tsx` : la séparation porte sur l'habillage, jamais sur
 * la sécurité.
 */
export default async function MerchantTabsLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const unreadCount = await countUnreadMessages(supabase, "merchant");

  return (
    <AppShell nav={<MerchantNav unreadCount={unreadCount} />}>
      {children}
      <InstallPrompt />
    </AppShell>
  );
}
