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
    /* Le repli est faux et doit se voir : `filloo.app` n'appartient pas au
       projet. On continue — le sujet VAPID n'empêche aucune distribution —
       mais journalisé, jamais silencieux. */
    console.error(
      "[push] NEXT_PUBLIC_SITE_URL absente : sujet VAPID de repli utilisé, à poser sur l'hébergeur.",
    );
  }
  webpush.setVapidDetails(site || "https://filloo.app", publique, privee);
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
  return (await envoyerPush(authUserId, contenu)).atteints;
}

type Resultat = { atteints: number; raison?: string };

/**
 * Comme `sendPushToUser`, avec la RAISON quand personne n'est atteint. Le
 * bouton de test en a besoin : « envoyée » sans preuve faisait chercher la
 * panne sur le téléphone alors qu'elle était sur le serveur.
 *
 * Deux canaux, en parallèle et indépendants : les navigateurs abonnés
 * (Web Push, 0023) et les téléphones qui portent l'app mobile (Expo,
 * 0035). L'un en panne n'empêche pas l'autre.
 */
export async function envoyerPush(authUserId: string, contenu: ContenuPush): Promise<Resultat> {
  const [web, telephone] = await Promise.all([envoyerPushWeb(authUserId, contenu), envoyerPushTelephone(authUserId, contenu)]);
  const atteints = web.atteints + telephone.atteints;
  if (atteints > 0) return { atteints };
  return { atteints, raison: `Navigateurs : ${web.raison ?? "aucun"} Téléphones : ${telephone.raison ?? "aucun"}` };
}

/** L'adresse de l'API d'envoi d'Expo, qui relaie vers Apple et Google. */
const EXPO_PUSH = "https://exp.host/--/api/v2/push/send";

/**
 * Les téléphones qui portent l'app mobile (`expo_push_tokens`, 0035). Le
 * `url` du contenu est un chemin du site ; l'app a les mêmes
 * (`/messages/…`, `/vendeur/messages/…`) et l'ouvre au toucher.
 *
 * `EXPO_ACCESS_TOKEN` est facultatif : posé, il exige que les envois
 * viennent de nous (réglage « Enhanced Security » du projet Expo).
 */
async function envoyerPushTelephone(authUserId: string, contenu: ContenuPush): Promise<Resultat> {
  try {
    const admin = createAdminClient();
    const { data: telephones, error } = await admin
      .from("expo_push_tokens")
      .select("id, token")
      .eq("auth_user_id", authUserId);
    if (error) {
      console.error("[push] téléphones illisibles :", error.message);
      return { atteints: 0, raison: `jetons illisibles (${error.message}).` };
    }
    if (!telephones.length) return { atteints: 0, raison: "aucun téléphone enregistré." };

    const jeton = process.env.EXPO_ACCESS_TOKEN;
    const reponse = await fetch(EXPO_PUSH, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...(jeton ? { Authorization: `Bearer ${jeton}` } : {}),
      },
      body: JSON.stringify(
        telephones.map((t) => ({
          to: t.token,
          title: contenu.titre,
          body: contenu.corps,
          data: { url: contenu.url },
          sound: "default",
          // Le canal Android créé par l'app (`messages`) : sans lui, la
          // notification arrive sans son ni bandeau sur certains téléphones.
          channelId: "messages",
          // Une notification par conversation : la nouvelle remplace l'ancienne.
          collapseId: contenu.tag,
          threadId: contenu.tag,
        })),
      ),
    });
    if (!reponse.ok) {
      console.error(`[push] Expo a refusé l'envoi (${reponse.status}) :`, await reponse.text());
      return { atteints: 0, raison: `Expo a refusé l'envoi (${reponse.status}).` };
    }

    /* Un ticket par téléphone, dans l'ordre. `DeviceNotRegistered` est la
       seule réponse qui dit « ce téléphone ne reçoit plus » (app
       désinstallée) : on retire la ligne, sinon elle serait réessayée à
       chaque message. Le reste est passager. */
    const { data: tickets } = (await reponse.json()) as {
      data: { status: "ok" | "error"; message?: string; details?: { error?: string } }[];
    };
    let atteints = 0;
    const echecs: string[] = [];
    await Promise.all(
      tickets.map(async (ticket, i) => {
        const telephone = telephones[i];
        if (!telephone) return;
        if (ticket.status === "ok") {
          atteints += 1;
          await admin.from("expo_push_tokens").update({ last_used_at: new Date().toISOString() }).eq("id", telephone.id);
          return;
        }
        if (ticket.details?.error === "DeviceNotRegistered") {
          await admin.from("expo_push_tokens").delete().eq("id", telephone.id);
          echecs.push("app désinstallée, jeton retiré");
          return;
        }
        echecs.push(ticket.details?.error ?? ticket.message ?? "refus sans motif");
        console.error("[push] ticket Expo en erreur :", ticket.details?.error, ticket.message);
      }),
    );
    return atteints > 0 ? { atteints } : { atteints, raison: `${echecs.join(" ; ")}.` };
  } catch (cause) {
    console.error("[push] envoi Expo impossible :", cause);
    return { atteints: 0, raison: `envoi impossible (${cause instanceof Error ? cause.message : String(cause)}).` };
  }
}

/** Les navigateurs abonnés (Web Push, 0023). */
async function envoyerPushWeb(authUserId: string, contenu: ContenuPush): Promise<Resultat> {
  if (!configurer()) {
    return { atteints: 0, raison: "Le serveur n'a pas ses clés de notification (VAPID)." };
  }

  const echecs: string[] = [];
  try {
    const admin = createAdminClient();
    const { data: abonnements, error } = await admin
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth_secret")
      .eq("auth_user_id", authUserId);
    if (error) {
      console.error("[push] abonnements illisibles :", error.message);
      return { atteints: 0, raison: `Le serveur ne peut pas lire les appareils abonnés (${error.message}).` };
    }
    if (!abonnements.length) return { atteints: 0, raison: "Aucun appareil abonné pour ce compte." };

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
            echecs.push("abonnement expiré, supprimé : réactivez les notifications");
            return;
          }
          /* 401/403 : le service de push refuse notre signature — la clé
             privée n'est pas la moitié de la clé publique du navigateur. */
          echecs.push(
            statut === 401 || statut === 403
              ? `refusé (${statut}) : VAPID_PRIVATE_KEY ne correspond pas à la clé publique`
              : `refusé (${statut ?? "sans code"})`,
          );
          console.error(`[push] envoi impossible (${statut ?? "sans code"}) :`, cause);
        }
      }),
    );

    return atteints > 0 ? { atteints } : { atteints, raison: `Envoi échoué : ${echecs.join(" ; ")}.` };
  } catch (cause) {
    console.error("[push] envoi impossible :", cause);
    const message = cause instanceof Error ? cause.message : String(cause);
    return { atteints: 0, raison: `Envoi impossible côté serveur (${message}).` };
  }
}
