import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

/**
 * Vérifie un mot de passe SANS toucher à la session en cours.
 *
 * Supabase n'expose aucun « ce mot de passe est-il le bon ? » : la seule
 * façon de le savoir est de s'en servir pour se connecter. Le faire avec le
 * client de `server.ts` marcherait — même compte — mais ce client-là ÉCRIT
 * LES COOKIES de session, et une faute de frappe qui déconnecte quelqu'un
 * au milieu d'un formulaire à moitié rempli serait pire que le défaut qu'on
 * corrige. Celui-ci n'a aucune mémoire : `persistSession: false`,
 * `autoRefreshToken: false`, aucun accès aux cookies de la requête. Il pose
 * une question, reçoit oui ou non, et disparaît.
 *
 * CE N'EST PAS UNE AUTORISATION. Il répond « ce mot de passe ouvre bien ce
 * compte », rien de plus : à l'appelant de vérifier d'abord QUI est
 * connecté, puis de n'agir que sur les données de cette personne-là. Le RLS
 * reste seul maître de ce qui s'écrit.
 *
 * Il utilise la clé publique `anon`, comme l'écran de connexion : la
 * limitation de débit d'authentification de Supabase s'applique donc ici
 * aussi, ce qu'un contrôle écrit à la main n'aurait pas offert.
 */
export async function passwordIsValid(email: string, password: string): Promise<boolean> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) throw new Error("Configuration Supabase manquante.");

  const jetable = createSupabaseClient<Database>(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  const { data, error } = await jetable.auth.signInWithPassword({ email, password });

  /* ON NE DÉCONNECTE PAS. LA VERSION PRÉCÉDENTE LE FAISAIT, ET C'ÉTAIT LE
     BUG : `signOut()` sans argument vaut `scope: "global"` chez Supabase,
     c'est-à-dire « révoque TOUS les jetons de cet utilisateur, partout ».
     Le client jetable révoquait donc aussi la session du NAVIGATEUR de la
     personne — qui se retrouvait déconnectée à chaque enregistrement
     d'informations et à chaque changement de mot de passe. Constaté à
     l'usage le 2026-09-19.

     L'intention d'origine — ne pas laisser traîner un jeton que personne
     n'utilisera — était bonne, mais l'outil ne sait pas faire ça : le
     client anonyme n'a aucun moyen de révoquer UNE session précise.
     `scope: "local"` ne ferait qu'effacer un stockage qui n'existe pas
     ici (`persistSession: false`), donc l'appeler serait du théâtre.

     Ce qui reste, et ce que ça coûte : le jeton obtenu par cette
     vérification vit jusqu'à son expiration, sans être écrit nulle part
     ni renvoyé à personne. C'est le même risque qu'une connexion normale
     dont on ferme l'onglet — et infiniment moins coûteux que déconnecter
     quelqu'un qui vient de prouver son identité. */

  return !error && Boolean(data?.session);
}
