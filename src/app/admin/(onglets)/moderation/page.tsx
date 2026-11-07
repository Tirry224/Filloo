import { ModerationVue } from "@/components/admin/ModerationVue";
import { lireComptesSuspendus, lireComptesTresSignales, lireSignalements } from "@/lib/data/moderation";
import { createClient } from "@/lib/supabase/server";

/** Les personnes signalées par 5 personnes ou plus (0055), les signalements à traiter et les comptes suspendus (0046). */
export default async function ModerationPage({ searchParams }: { searchParams: Promise<{ erreur?: string; info?: string }> }) {
  const { erreur, info } = await searchParams;
  const supabase = await createClient();
  const [tresSignales, signalements, suspendus] = await Promise.all([
    lireComptesTresSignales(supabase),
    lireSignalements(supabase),
    lireComptesSuspendus(supabase),
  ]);
  return <ModerationVue tresSignales={tresSignales} signalements={signalements} suspendus={suspendus} erreur={erreur} info={info} />;
}
