import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

/**
 * Client ANONYME, sans cookies : il ne porte la session de personne.
 *
 * `admin.ts` ignore le RLS ; utilisé ici, il publierait les brouillons de
 * tout le monde.
 *
 * `persistSession: false` parce qu'il n'y a aucune session à garder, et
 * `autoRefreshToken: false` pour qu'aucune minuterie ne se lance dans une
 * fonction serverless qui doit se terminer.
 */
export function createPublicClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
