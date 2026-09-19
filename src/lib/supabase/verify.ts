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
 * Cette dernière phrase a été FAUSSE pendant trois jours : le code
 * appelait `signOut()` après vérification, et cet appel est GLOBAL chez
 * Supabase — il révoquait la session du navigateur. Voir le commentaire
 * qui suit l'appel, plus bas : « ne rien faire » était la bonne
 * réponse.
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
