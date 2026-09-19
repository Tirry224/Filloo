import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * L'envoi d'une notification push, côté serveur.
 *
 * POURQUOI `service_role` (`createAdminClient`)
 * Les abonnements d'une personne ne sont lisibles que par elle
 * (RLS de `0023`). Or c'est l'EXPÉDITEUR du message qui déclenche l'envoi,
 * et il n'a évidemment aucun droit sur les appareils du destinataire —
 * heureusement : ces trois valeurs donnent le droit d'écrire sur son écran
 * verrouillé. La lecture se fait donc ici, côté serveur, et ne repart
 * vers aucun écran.
 *
 * CE QUI PART, ET CE QUI NE PART PAS
 * Le corps du message n'est PAS recopié dans la notification. Un push
 * s'affiche sur un écran verrouillé, que n'importe qui à côté peut lire.
 * L'email, lui, recopie l'extrait — parce qu'il faut déverrouiller son
 * téléphone et ouvrir sa boîte pour le voir. Deux canaux, deux niveaux
 * d'exposition, deux contenus.
 */

/** Une paire VAPID absente n'est pas une panne : c'est l'état d'un projet
 *  dont les clés ne sont pas encore posées. On le dit une fois et on
 *  s'arrête, sans rien tenter. */
function configurer(): boolean {
  const publique = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privee = process.env.VAPID_PRIVATE_KEY;
  if (!publique || !privee) return false;

  /* Le « sujet » VAPID identifie l'expéditeur auprès du service de push,
     qui s'en sert pour nous joindre en cas d'abus. Le standard accepte une
     adresse email ou une URL ; on donne l'URL du site, jamais l'adresse
     personnelle du porteur du projet — elle partirait chez Google, Apple
     et Mozilla sans raison. */
  const sujet = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/+$/, "") || "https://makiti.app";
  webpush.setVapidDetails(sujet, publique, privee);
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

/**
 * Envoie à TOUS les appareils d'une connexion. Une personne a souvent un
 * téléphone et parfois un ordinateur ; prévenir un seul des deux, c'est
 * prévenir celui qu'elle n'a pas en main.
 *
 * Ne lève jamais : une notification est un service rendu en plus, elle ne
 * doit pas casser l'envoi du message qui l'a déclenchée.
 */
export async function sendPushToUser(authUserId: string, contenu: ContenuPush): Promise<void> {
  if (!configurer()) return;

  try {
    const admin = createAdminClient();
    const { data: abonnements, error } = await admin
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth_secret")
      .eq("auth_user_id", authUserId);
    if (error || !abonnements?.length) return;

    const charge = JSON.stringify(contenu);

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
          await admin
            .from("push_subscriptions")
            .update({ last_used_at: new Date().toISOString() })
            .eq("id", abonnement.id);
        } catch (cause) {
          const statut = (cause as { statusCode?: number }).statusCode;

          /* 404 et 410 sont les DEUX seules réponses qui veulent dire
             « cet appareil n'existe plus » : application désinstallée,
             données du navigateur effacées, abonnement révoqué. On
             supprime la ligne immédiatement. Sans ça, la table se remplit
             de fantômes qu'on réessaie à chaque message, indéfiniment —
             et les services de push finissent par nous considérer comme
             un émetteur négligent.

             Tout le reste (429, 500, réseau) est passager : on garde la
             ligne et on réessaiera au message suivant. */
          if (statut === 404 || statut === 410) {
            await admin.from("push_subscriptions").delete().eq("id", abonnement.id);
            return;
          }
          console.error(`[push] envoi impossible (${statut ?? "sans code"}) :`, cause);
        }
      }),
    );
  } catch (cause) {
    console.error("[push] envoi impossible :", cause);
  }
}
