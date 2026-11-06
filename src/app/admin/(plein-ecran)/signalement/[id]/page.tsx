import { notFound, redirect } from "next/navigation";
import { SignalementVue } from "@/components/admin/SignalementVue";
import { lireMessagesSignales, lireSignalement } from "@/lib/data/moderation";
import { estUuid } from "@/lib/saisie";
import { createClient } from "@/lib/supabase/server";

/** Un signalement à traiter (0046). Déjà traité, il renvoie à la liste plutôt qu'à une page introuvable. */
export default async function SignalementPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ erreur?: string }>;
}) {
  const { id } = await params;
  if (!estUuid(id)) notFound();
  const { erreur } = await searchParams;

  const supabase = await createClient();
  const s = await lireSignalement(supabase, id);
  if (!s) redirect(`/admin/moderation?info=${encodeURIComponent("Ce signalement a déjà été traité.")}`);
  const messages = s.target_type === "conversation" ? await lireMessagesSignales(supabase, id) : [];
  return <SignalementVue s={s} messages={messages} erreur={erreur} />;
}
