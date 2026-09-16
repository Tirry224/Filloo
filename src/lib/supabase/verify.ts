import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

/**
 * Vérifie un mot de passe SANS toucher à la session en cours.
 *
 * POURQUOI CE FICHIER EXISTE, ET PAS UN SIMPLE APPEL
 * Supabase n'expose aucun « ce mot de passe est-il le bon ? ». La seule
 * façon de le savoir est de s'en servir pour se connecter. Le faire avec
 * le client de `server.ts` marcherait — c'est le même compte — mais ce
 * client-là ÉCRIT LES COOKIES de session, et on ne sait pas ce qu'il en
 * fait quand la connexion échoue. Une faute de frappe qui déconnecte la
 * personne au milieu d'un formulaire à moitié rempli serait un défaut bien
 * pire que celui qu'on cherche à corriger.
 *
 * Ce client-ci n'a aucune mémoire : `persistSession: false` et
 * `autoRefreshToken: false` lui interdisent de garder ou de renouveler
 * quoi que ce soit, et il ne connaît pas les cookies de la requête. Il
 * pose une question, reçoit oui ou non, et disparaît. La session de la
 * personne ne peut donc pas être abîmée par le résultat, quel qu'il soit.
 *
 * CE QU'IL N'EST PAS
 * Ce n'est pas une autorisation. Il répond « ce mot de passe ouvre bien ce
 * compte », rien de plus : c'est à l'appelant de vérifier d'abord QUI est
 * connecté, puis de n'agir que sur les données de cette personne-là. Le
 * RLS reste seul maître de ce qui s'écrit.
 *
 * Il utilise la clé publique (`anon`), pas `service_role` : vérifier un
 * mot de passe est exactement ce que fait l'écran de connexion, avec les
 * mêmes droits. La limitation de débit d'authentification de Supabase
 * s'applique donc ici aussi — essayer des mots de passe en série finit par
 * être refusé, ce qu'un contrôle écrit à la main dans notre code n'aurait
 * pas offert.
 */
export async function passwordIsValid(email: string, password: string): Promise<boolean> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) throw new Error("Configuration Supabase manquante.");

  const jetable = createSupabaseClient<Database>(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  const { data, error } = await jetable.auth.signInWithPassword({ email, password });

  /* On referme derrière soi. `persistSession: false` fait déjà que rien
     n'est écrit nulle part, mais le jeton obtenu reste valable côté
     Supabase jusqu'à son expiration : le révoquer tout de suite évite de
     laisser traîner une session que personne n'utilisera. Son échec ne
     change rien au résultat, d'où le `catch` silencieux. */
  if (data?.session) {
    await jetable.auth.signOut().catch(() => {});
  }

  return !error && Boolean(data?.session);
}
