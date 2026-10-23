"use server";

import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/data/session";
import type { ActionState } from "@/lib/actions/auth";
import { messagePourErreur } from "@/lib/erreurs";

/**
 * Le client de SESSION, non `service_role` : contrairement à l'envoi
 * (`src/lib/push.ts`), ces trois actions ne touchent que les appareils de
 * la personne connectée. Le RLS de `0023` suffit, et un bug ici ne peut
 * pas abonner un téléphone au nom d'un tiers.
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

  const supabase = await createClient();
  const user = await getSessionUser(supabase);
  if (!user) return { error: "Connectez-vous d'abord." };

  /* `upsert` sur `endpoint`, non `insert` : le même appareil se réabonne
     régulièrement (mise à jour du navigateur, effacement de données), et
     un `insert` afficherait une erreur pour un geste qui a réussi côté
     navigateur. */
  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      auth_user_id: user.id,
      endpoint,
      p256dh,
      auth_secret: auth,
      user_agent: userAgent.slice(0, 300) || null,
    },
    { onConflict: "endpoint" },
  );
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
