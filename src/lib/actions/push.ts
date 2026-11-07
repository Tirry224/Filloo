"use server";

import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/data/session";
import type { ActionState } from "@/lib/actions/auth";
import { messagePourErreur } from "@/lib/erreurs";
import { estAdressePush } from "@/lib/push-adresse";

/**
 * Le client de SESSION, non `service_role` : contrairement à l'envoi
 * (`src/lib/push.ts`), ces trois actions ne touchent que les appareils de
 * la personne connectée. Le RLS de `0023` (et, pour l'enregistrement,
 * `enregistrer_appareil_push` qui lit `auth.uid()`) fait qu'un bug ici ne
 * peut pas abonner un téléphone au nom d'un tiers.
 */

/** Ce que `PushSubscription.toJSON()` rend. Recopié plutôt qu'importé :
 *  les types DOM ne traversent pas la frontière client/serveur. */
export type AbonnementNavigateur = {
  endpoint: string;
  keys?: { p256dh?: string; auth?: string };
};

export async function savePushSubscriptionAction(
  abonnement: AbonnementNavigateur,
  userAgent: string,
): Promise<ActionState> {
  const endpoint = abonnement?.endpoint ?? "";
  const p256dh = abonnement?.keys?.p256dh ?? "";
  const auth = abonnement?.keys?.auth ?? "";
  if (!endpoint || !p256dh || !auth) {
    return { error: "Abonnement incomplet. Réessayez." };
  }
  // Sinon le serveur enverrait ses requêtes à l'adresse de n'importe qui (voir `push-adresse.ts`).
  if (!estAdressePush(endpoint)) {
    return { error: "Ce navigateur ne peut pas recevoir les notifications de Filloo." };
  }

  const supabase = await createClient();
  const user = await getSessionUser(supabase);
  if (!user) return { error: "Connectez-vous d'abord." };

  /* Par la fonction `enregistrer_appareil_push` (0069), non un `upsert` :
     l'adresse d'un navigateur est unique pour toute la table, et quand un
     second compte se connectait sur le même appareil, l'`upsert` visait la
     ligne du premier et le RLS le refusait (58 refus en 24 h, constaté le
     2026-11-07). Le second compte ne recevait rien, et le premier recevait
     encore SES notifications sur un appareil qui n'était plus le sien. La
     fonction donne l'appareil à la connexion qui l'enregistre. */
  const { error } = await supabase.rpc("enregistrer_appareil_push", {
    p_endpoint: endpoint,
    p_p256dh: p256dh,
    p_auth: auth,
    p_user_agent: userAgent.slice(0, 300) || undefined,
  });
  if (error) return { error: messagePourErreur(error, "push") };

  return { sent: true };
}

export async function deletePushSubscriptionAction(endpoint: string): Promise<ActionState> {
  if (!endpoint) return { error: "Aucun appareil à désabonner." };

  const supabase = await createClient();
  const user = await getSessionUser(supabase);
  if (!user) return { error: "Connectez-vous d'abord." };

  // Pas de `eq("auth_user_id", …)` : le RLS le fait, et le répéter ici
  // laisserait croire que c'est ce filtre qui protège.
  const { error } = await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
  if (error) return { error: messagePourErreur(error, "push") };

  return { sent: true };
}
