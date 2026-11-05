import { AdminNav } from "@/components/admin/AdminNav";
import { AppShell } from "@/components/ui/AppShell";
import { compterNonLusBoite } from "@/lib/data/equipe";
import { createClient } from "@/lib/supabase/server";

/** Les onglets de l'équipe : la même charpente que les espaces client et commerçant. */
export default async function AdminTabsLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const nonLus = await compterNonLusBoite(supabase);
  return <AppShell nav={<AdminNav unreadCount={nonLus} />}>{children}</AppShell>;
}
