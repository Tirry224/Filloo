import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

/**
 * Client `service_role` : il IGNORE LE RLS, donc uniquement depuis du code
 * serveur sans session (ex. `src/lib/actions/account.ts`) — jamais un
 * composant client, jamais transmis au navigateur.
 * `SUPABASE_SERVICE_ROLE_KEY`, sans préfixe `NEXT_PUBLIC_`, reste hors du
 * bundle et hors des fichiers versionnés.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY manquante : à ajouter dans les variables d'environnement du serveur (jamais dans .env, jamais avec le préfixe NEXT_PUBLIC_).",
    );
  }
  return createSupabaseClient<Database>(url, serviceRoleKey);
}
