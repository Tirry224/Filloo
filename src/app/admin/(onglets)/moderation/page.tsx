import { ModerationVue } from "@/components/admin/ModerationVue";
import { lireComptesSuspendus, lireSignalements } from "@/lib/data/moderation";
import { createClient } from "@/lib/supabase/server";

/** Les signalements à traiter et les comptes suspendus (0046). */
export default async function ModerationPage({ searchParams }: { searchParams: Promise<{ erreur?: string; info?: string }> }) {
  const { erreur, info } = await searchParams;
  const supabase = await createClient();
  const [signalements, suspendus] = await Promise.all([lireSignalements(supabase), lireComptesSuspendus(supabase)]);
  return <ModerationVue signalements={signalements} suspendus={suspendus} erreur={erreur} info={info} />;
}
