import { createAdminClient } from "@/lib/supabase/admin";

/**
 * `true` la PREMIÈRE fois qu'on annonce `cle` (« message:<id> »,
 * « equipe:<id> »), `false` ensuite.
 *
 * Sans elle, `/api/app/message-envoye` rappelé en boucle pendant ses deux
 * minutes faisait sonner le destinataire autant de fois (audit du
 * 2026-11-07). La clé primaire de `notifications_envoyees` (0054) tranche
 * même entre deux appels simultanés : un seul insère.
 *
 * Si la base ne répond pas, on prévient quand même : mieux vaut une
 * notification en double qu'un message que personne ne voit arriver.
 */
export async function premiereAnnonce(cle: string): Promise<boolean> {
  try {
    const { error } = await createAdminClient().from("notifications_envoyees").insert({ cle });
    if (!error) return true;
    if (error.code === "23505") return false; // déjà annoncé
    console.error(`[notification] mémoire illisible (${cle}), envoi quand même :`, error.message);
    return true;
  } catch (cause) {
    console.error(`[notification] mémoire injoignable (${cle}), envoi quand même :`, cause);
    return true;
  }
}
