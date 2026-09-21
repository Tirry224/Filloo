import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

/**
 * Vérifie un mot de passe SANS toucher à la session en cours.
 *
 * Supabase n'expose aucun « ce mot de passe est-il le bon ? » : il faut
 * s'en servir pour se connecter. Le client de `server.ts` écrirait les
 * cookies de session, et une faute de frappe déconnecterait au milieu d'un
 * formulaire ; celui-ci n'a aucune mémoire (`persistSession: false`,
 * `autoRefreshToken: false`, aucun accès aux cookies).
 *
 * CE N'EST PAS UNE AUTORISATION : il répond « ce mot de passe ouvre bien
 * ce compte », rien de plus. À l'appelant de vérifier qui est connecté ;
 * le RLS reste seul maître de ce qui s'écrit.
 *
 * Il utilise la clé `anon`, comme l'écran de connexion : la limitation de
 * débit d'authentification de Supabase s'applique donc ici aussi.
 */
export async function passwordIsValid(email: string, password: string): Promise<boolean> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) throw new Error("Configuration Supabase manquante.");

  const jetable = createSupabaseClient<Database>(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  const { data, error } = await jetable.auth.signInWithPassword({ email, password });

  /* ON NE DÉCONNECTE PAS : `signOut()` sans argument vaut
     `scope: "global"` chez Supabase, donc révoquerait aussi la session du
     NAVIGATEUR de la personne à chaque vérification. Et le client anonyme
     n'a aucun moyen de révoquer UNE session précise — `scope: "local"`
     n'effacerait qu'un stockage qui n'existe pas ici.

     Ce que ça coûte : le jeton obtenu vit jusqu'à son expiration, écrit
     nulle part et renvoyé à personne — le risque d'un onglet fermé. */

  return !error && Boolean(data?.session);
}
