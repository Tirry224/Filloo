import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";
import { siteUrl } from "@/lib/site-url";

/**
 * `service_role` (`createAdminClient`) parce que les abonnements ne sont
 * lisibles que par leur propriétaire (RLS de `0023`), alors que l'envoi est
 * déclenché par l'EXPÉDITEUR du message. Ces trois valeurs donnent le droit
 * d'écrire sur l'écran verrouillé du destinataire : elles ne repartent
 * jamais vers un écran.
 *
 * Le corps du message ne part pas — un push se lit par-dessus l'épaule,
 * l'email demande de déverrouiller.
 */

function configurer(): boolean {
  const publique = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privee = process.env.VAPID_PRIVATE_KEY;
  if (!publique || !privee) return false;

  /* Le « sujet » VAPID identifie l'expéditeur auprès du service de push,
     qui s'en sert pour nous joindre en cas d'abus. On donne l'URL du site,
     jamais une adresse personnelle : elle partirait chez Google, Apple et
     Mozilla sans raison. */
  const site = siteUrl();
  if (!site) {
    /* Le repli est faux et doit se voir : `makiti.app` n'appartient pas au
       projet. On continue — le sujet VAPID n'empêche aucune distribution —
       mais journalisé, jamais silencieux. */
    console.error(
      "[push] NEXT_PUBLIC_SITE_URL absente : sujet VAPID de repli utilisé, à poser sur l'hébergeur.",
    );
  }
  webpush.setVapidDetails(site || "https://makiti.app", publique, privee);
  return true;
}

export type ContenuPush = {
  titre: string;
  corps: string;
  /** Chemin interne où amener la personne au clic. Relatif, jamais absolu. */
  url: string;
  /** Regroupe les notifications d'un même fil : la nouvelle remplace la précédente. */
  tag: string;
};

export async function sendPushToUser(authUserId: string, contenu: ContenuPush): Promise<number> {
  if (!configurer()) return 0;

  try {
    const admin = createAdminClient();
    const { data: abonnements, error } = await admin
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth_secret")
      .eq("auth_user_id", authUserId);
    if (error) {
      console.error("[push] abonnements illisibles :", error.message);
      return 0;
    }
    if (!abonnements.length) return 0;

    const charge = JSON.stringify(contenu);
    let atteints = 0;

    await Promise.all(
      abonnements.map(async (abonnement) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: abonnement.endpoint,
              keys: { p256dh: abonnement.p256dh, auth: abonnement.auth_secret },
            },
            charge,
          );
          atteints += 1;
          await admin
            .from("push_subscriptions")
            .update({ last_used_at: new Date().toISOString() })
            .eq("id", abonnement.id);
        } catch (cause) {
          const statut = (cause as { statusCode?: number }).statusCode;

          /* 404 et 410 sont les seules réponses qui disent « cet appareil
             n'existe plus » : on supprime la ligne, sinon la table se
             remplit de fantômes réessayés à chaque message. Tout le reste
             (429, 500, réseau) est passager. */
          if (statut === 404 || statut === 410) {
            await admin.from("push_subscriptions").delete().eq("id", abonnement.id);
            return;
          }
          console.error(`[push] envoi impossible (${statut ?? "sans code"}) :`, cause);
        }
      }),
    );

    return atteints;
  } catch (cause) {
    console.error("[push] envoi impossible :", cause);
    return 0;
  }
}
