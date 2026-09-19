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
  const site = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/+$/, "");
  if (!site) {
    /* LE REPLI EST FAUX, ET IL DOIT SE VOIR. `makiti.app` n'appartient
       pas au projet : c'est l'adresse que Google, Apple et Mozilla
       liraient pour nous joindre en cas d'abus, donc une identité
       d'expéditeur qui ne mène nulle part. On continue quand même —
       couper les notifications pour une variable oubliée serait une
       punition disproportionnée, et le sujet VAPID n'empêche aucune
       distribution — mais on le DIT dans les journaux, une fois par
       invocation, plutôt que de laisser ce mensonge silencieux. */
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

/**
 * Envoie à TOUS les appareils d'une connexion. Une personne a souvent un
 * téléphone et parfois un ordinateur ; prévenir un seul des deux, c'est
 * prévenir celui qu'elle n'a pas en main.
 *
 * Ne lève jamais : une notification est un service rendu en plus, elle ne
 * doit pas casser l'envoi du message qui l'a déclenchée.
 *
 * REND LE NOMBRE D'APPAREILS RÉELLEMENT ATTEINTS, et pas `void` comme au
 * début. `notifyNewMessage` n'en fait rien — là-bas, l'email est le canal
 * de secours et le push n'engage rien. Mais `drainNotifications` en a
 * besoin : quand l'email n'est pas configuré, ce chiffre est la SEULE
 * façon de savoir si une décision d'administration a été annoncée à
 * quelqu'un ou n'a été annoncée à personne. Marquer « envoyée » une
 * décision que personne n'a reçue la perdrait définitivement.
 */
export async function sendPushToUser(authUserId: string, contenu: ContenuPush): Promise<number> {
  if (!configurer()) return 0;

  try {
    const admin = createAdminClient();
    const { data: abonnements, error } = await admin
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth_secret")
      .eq("auth_user_id", authUserId);
    if (error || !abonnements?.length) return 0;

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

    return atteints;
  } catch (cause) {
    console.error("[push] envoi impossible :", cause);
    return 0;
  }
}
