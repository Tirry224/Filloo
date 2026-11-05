import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { clientSpaceFallback, getMyProfile, getSessionUser } from "@/lib/data/session";
import type { Espace } from "@/lib/espace";
import { createClient } from "@/lib/supabase/server";

/**
 * La garde des écrans « Équipe Filloo ». L'espace commerçant est gardé par
 * son layout ; le client, non : c'est ici qu'il l'est.
 */
export async function gardeEquipe(espace: Espace): Promise<{ supabase: Awaited<ReturnType<typeof createClient>>; user: User }> {
  const supabase = await createClient();
  if (espace === "client") {
    const client = await getMyProfile(supabase, "client");
    if (!client) redirect(await clientSpaceFallback(supabase));
    if (client.isSuspended) redirect("/compte/suspendu");
  }
  const user = await getSessionUser(supabase);
  if (!user) redirect("/connexion");
  return { supabase, user };
}
