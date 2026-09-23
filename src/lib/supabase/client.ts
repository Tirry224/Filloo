import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/database.types";

/**
 * Client Supabase pour le navigateur. À utiliser uniquement dans un
 * composant `"use client"`.
 */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

/**
 * Un abonnement parti avant la lecture de la session rejoint le canal en
 * `anon` : le RLS de `messages` ne lui transmet alors aucun événement.
 */
export async function createRealtimeClient() {
  const supabase = createClient();
  const { data } = await supabase.auth.getSession();
  await supabase.realtime.setAuth(data.session?.access_token ?? null);
  return supabase;
}
