"use server";

import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/data/session";
import { sendPushToUser } from "@/lib/push";
import type { ActionState } from "@/lib/actions/auth";

/**
 * Enregistrer, oublier, tester : les trois gestes d'un abonnement push.
 *
 * POURQUOI LE CLIENT DE SESSION, ET NON `service_role`
 * Contrairement à l'ENVOI (`src/lib/push.ts`), qui doit lire les appareils
 * de quelqu'un d'autre, ces trois actions ne touchent QUE les appareils de
 * la personne connectée. Le RLS de `0023` suffit donc, et c'est mieux : un
 * bug ici ne peut pas abonner un téléphone au nom d'un tiers, parce que la
 * base refuserait la ligne.
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
  if (!user) return { error: "Vous devez être connecté." };

  /* `upsert` sur `endpoint` et non `insert` : le même appareil se
     réabonne régulièrement — après une mise à jour du navigateur, un
     effacement de données, un changement de compte. Un `insert` échouerait
     sur la contrainte d'unicité et la personne verrait une erreur pour un
     geste qui a parfaitement réussi côté navigateur. */
  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      auth_user_id: user.id,
      endpoint,
      p256dh,
      auth_secret: auth,
      /* Tronqué : sert à reconnaître un appareil dans une liste, pas à
         archiver la chaîne complète que certains navigateurs rendent
         interminable. */
      user_agent: userAgent.slice(0, 300) || null,
    },
    { onConflict: "endpoint" },
  );
  if (error) return { error: error.message };

  return { sent: true };
}

export async function deletePushSubscriptionAction(endpoint: string): Promise<ActionState> {
  if (!endpoint) return { error: "Aucun appareil à désabonner." };

  const supabase = await createClient();
  const user = await getSessionUser(supabase);
  if (!user) return { error: "Vous devez être connecté." };

  /* Pas de `eq("auth_user_id", …)` : le RLS le fait déjà, et le répéter
     ici laisserait croire que c'est lui qui protège. Si la policy
     disparaissait un jour, ce filtre-là ne sauverait rien — c'est en base
     que la règle doit vivre. */
  const { error } = await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
  if (error) return { error: error.message };

  return { sent: true };
}

/**
 * S'envoyer une notification à soi-même.
 *
 * C'est la seule façon de vérifier la chaîne ENTIÈRE — permission,
 * abonnement, clés VAPID, service de push, service worker — sans avoir
 * besoin d'un deuxième compte et d'un deuxième téléphone. Elle reste dans
 * l'application après la mise au point : le jour où un commerçant dira
 * « je ne reçois rien », ce bouton répondra en trois secondes.
 */
export async function sendTestPushAction(): Promise<ActionState> {
  const supabase = await createClient();
  const user = await getSessionUser(supabase);
  if (!user) return { error: "Vous devez être connecté." };

  const { count, error } = await supabase
    .from("push_subscriptions")
    .select("id", { count: "exact", head: true });
  if (error) return { error: error.message };
  if (!count) return { error: "Aucun appareil abonné. Activez d'abord les notifications." };

  await sendPushToUser(user.id, {
    titre: "Makiti",
    corps: "Test réussi : les notifications fonctionnent sur cet appareil.",
    url: "/compte",
    tag: "makiti-test",
  });

  return { sent: true };
}
