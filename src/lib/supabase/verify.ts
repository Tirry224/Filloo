import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { messageErreurAuth } from "@/lib/erreurs-auth";
import { createAdminClient } from "@/lib/supabase/admin";

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
 *
 * ET UNE LIMITE PAR COMPTE, la nôtre (audit du 2026-11-07) : toutes ces
 * vérifications partent des mêmes adresses de Vercel, si bien que la
 * limite de Supabase (par adresse) se partage entre TOUS les comptes. Une
 * seule personne qui enchaîne les faux mots de passe la déclencherait pour
 * tout le monde. Au-delà de `ESSAIS_MAX` échecs en `FENETRE_MS`, on répond
 * « trop d'essais » sans interroger Supabase ; le blocage se lève seul, et
 * ne touche que l'étape « confirmez votre mot de passe », jamais la
 * connexion. Les échecs vivent dans `essais_mot_de_passe` (0053), que seul
 * le serveur lit.
 */
const ESSAIS_MAX = 5;
const FENETRE_MS = 15 * 60 * 1000;
const TROP_D_ESSAIS = {
  incorrect: false,
  trop: true,
  message: "Trop d'essais avec un mauvais mot de passe. Réessayez dans 15 minutes.",
};
/**
 * `null` : le mot de passe ouvre bien ce compte. Sinon, ce qu'il faut
 * dire, et si c'est le MOT DE PASSE qui est faux (`incorrect`).
 *
 * Avant le 2026-10-23, toute erreur répondait « faux » : trop d'essais ou
 * Supabase injoignable s'affichaient « mot de passe incorrect », et la
 * personne retapait le bon mot de passe sans comprendre.
 */
export async function refusMotDePasse(
  compte: { id: string; email: string },
  password: string,
): Promise<null | { incorrect: boolean; trop: boolean; message: string }> {
  if ((await echecsRecents(compte.id)) >= ESSAIS_MAX) return TROP_D_ESSAIS;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) throw new Error("Configuration Supabase manquante.");

  const jetable = createSupabaseClient<Database>(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  const { data, error } = await jetable.auth.signInWithPassword({ email: compte.email, password });

  /* ON NE DÉCONNECTE PAS : `signOut()` sans argument vaut
     `scope: "global"` chez Supabase, donc révoquerait aussi la session du
     NAVIGATEUR de la personne à chaque vérification. Et le client anonyme
     n'a aucun moyen de révoquer UNE session précise — `scope: "local"`
     n'effacerait qu'un stockage qui n'existe pas ici.

     Ce que ça coûte : le jeton obtenu vit jusqu'à son expiration, écrit
     nulle part et renvoyé à personne — le risque d'un onglet fermé. */

  if (!error && data?.session) {
    await oublierEchecs(compte.id);
    return null;
  }
  if (!error || error.code === "invalid_credentials" || error.message.includes("Invalid login credentials")) {
    await noterEchec(compte.id);
    return { incorrect: true, trop: false, message: "Mot de passe incorrect." };
  }
  return { incorrect: false, trop: error.status === 429, message: messageErreurAuth(error.message) };
}

/* Si la base ne répond pas (ou la clé `service_role` manque), on laisse
   passer en le journalisant : cette limite s'ajoute à celle de Supabase,
   elle ne doit pas empêcher quelqu'un de modifier sa boutique. */
async function echecsRecents(authUserId: string): Promise<number> {
  try {
    const { count, error } = await createAdminClient()
      .from("essais_mot_de_passe")
      .select("id", { count: "exact", head: true })
      .eq("auth_user_id", authUserId)
      .gte("created_at", new Date(Date.now() - FENETRE_MS).toISOString());
    if (error) throw new Error(error.message);
    return count ?? 0;
  } catch (cause) {
    console.error("[mot de passe] essais illisibles, limite non appliquée :", cause instanceof Error ? cause.message : cause);
    return 0;
  }
}

async function noterEchec(authUserId: string): Promise<void> {
  try {
    const { error } = await createAdminClient().from("essais_mot_de_passe").insert({ auth_user_id: authUserId });
    if (error) throw new Error(error.message);
  } catch (cause) {
    console.error("[mot de passe] échec non noté :", cause instanceof Error ? cause.message : cause);
  }
}

async function oublierEchecs(authUserId: string): Promise<void> {
  try {
    const { error } = await createAdminClient().from("essais_mot_de_passe").delete().eq("auth_user_id", authUserId);
    if (error) throw new Error(error.message);
  } catch (cause) {
    console.error("[mot de passe] échecs non effacés :", cause instanceof Error ? cause.message : cause);
  }
}
