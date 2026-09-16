import { createAdminClient } from "@/lib/supabase/admin";
import { escapeHtml, sendEmail } from "@/lib/email";

/**
 * Prévenir par email la personne qui vient de recevoir un message.
 *
 * C'est le point 1 de `docs/REPRISE.md` : sans cet email, la messagerie
 * est une boîte aux lettres que personne ne relève. Un commerçant qui
 * n'est jamais prévenu ne revient pas, et tout le produit repose sur
 * cette messagerie.
 *
 * POURQUOI `service_role` (`createAdminClient`)
 * L'adresse du destinataire vit dans `auth.users`, que le RLS ne couvre
 * pas et qu'aucune session cliente ne peut lire. Et c'est heureux :
 * l'expéditeur ne doit JAMAIS pouvoir obtenir l'email de son
 * interlocuteur — ce serait contourner la messagerie interne, qui est le
 * seul canal prévu par SPEC. L'adresse est donc lue ici, côté serveur,
 * utilisée pour l'envoi, et ne repart vers aucun écran.
 *
 * POURQUOI PAS UN TRIGGER EN BASE, NI UNE EDGE FUNCTION
 * Le même raisonnement que la suppression de compte
 * (`src/lib/supabase/admin.ts`) : une action serveur fait exactement la
 * même chose, avec un aller-retour de moins et un seul système à
 * déployer. Un trigger `pg_net` ajouterait une extension, une clé
 * d'API stockée en base et un chemin d'échec invisible depuis Vercel.
 */
export async function notifyNewMessage(messageId: string): Promise<void> {
  try {
    /* Le service n'est pas branché — l'état normal tant que la clé Resend
       n'est pas posée. On s'arrête AVANT les requêtes ci-dessous : une
       fonctionnalité éteinte ne doit rien coûter à l'envoi d'un message,
       et surtout pas quatre allers-retours en base par message. */
    if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM) return;

    /* Sans adresse de site, le lien de l'email serait relatif — donc mort
       dans une boîte mail. Un email qui annonce un message et ne permet
       pas d'y aller est pire que pas d'email : il fait ouvrir, chercher,
       et abandonner. Signalé, lui, parce que c'est une configuration à
       moitié faite et non un service volontairement éteint. */
    const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/+$/, "");
    if (!siteUrl) {
      console.error("[email] NEXT_PUBLIC_SITE_URL absente : notification non envoyée.");
      return;
    }

    const admin = createAdminClient();

    const { data: message, error: messageError } = await admin
      .from("messages")
      .select("id, conversation_id, sender_id, body, products(title)")
      .eq("id", messageId)
      .single<{
        id: string;
        conversation_id: string;
        sender_id: string;
        body: string;
        products: { title: string } | null;
      }>();
    if (messageError || !message) return;

    /* LA RÈGLE QUI ÉVITE LE SPAM, ET ELLE NE COÛTE AUCUNE COLONNE.
       On ne prévient QUE si ce message est le premier non lu du fil. S'il
       reste un message non lu du même expéditeur, le destinataire a déjà
       reçu un email pour ce fil et n'est pas revenu : lui en envoyer un
       second ne l'informe de rien, et c'est exactement ainsi qu'on finit
       en courrier indésirable — après quoi plus AUCUNE notification
       n'arrive, y compris les utiles.

       Deux personnes qui échangent dix messages produisent donc un seul
       email. Dès que le destinataire ouvre le fil, `read_at` se pose
       (`/messages/[id]`) et le message suivant redevient notifiable.

       C'est `read_at`, qui existe depuis 0001, qui porte toute la règle :
       pas de colonne « déjà notifié », pas de table de file d'attente,
       pas de tâche planifiée à surveiller. */
    const { count: alreadyWaiting, error: countError } = await admin
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("conversation_id", message.conversation_id)
      .eq("sender_id", message.sender_id)
      .is("read_at", null)
      .neq("id", message.id);
    if (countError) return;
    if ((alreadyWaiting ?? 0) > 0) return;

    const { data: conversation, error: conversationError } = await admin
      .from("conversations")
      .select(
        "client_id, merchants(profile_id, shop_name), profiles!conversations_client_id_fkey(full_name)",
      )
      .eq("id", message.conversation_id)
      .single<{
        client_id: string;
        merchants: { profile_id: string; shop_name: string } | null;
        profiles: { full_name: string } | null;
      }>();
    if (conversationError || !conversation?.merchants) return;

    /* Qui reçoit, et sous quel nom l'autre apparaît : la même règle que
       `getThreadContext` — côté client on parle à une BOUTIQUE, côté
       boutique on parle à une PERSONNE. Un email signé « Aissatou » quand
       l'écran affiche « Chez Aissatou » sèmerait le doute sur son
       authenticité, ce qui est précisément ce qu'un email transactionnel
       ne peut pas se permettre. */
    const merchantProfileId = conversation.merchants.profile_id;
    const senderIsMerchant = message.sender_id === merchantProfileId;
    const recipientProfileId = senderIsMerchant ? conversation.client_id : merchantProfileId;
    const senderName = senderIsMerchant
      ? conversation.merchants.shop_name
      : (conversation.profiles?.full_name ?? "Un client");

    const { data: recipient, error: recipientError } = await admin
      .from("profiles")
      .select("auth_user_id, full_name, is_deleted")
      .eq("id", recipientProfileId)
      .single();
    if (recipientError || !recipient) return;
    /* Un compte supprimé est banni côté `auth.users` : l'email partirait
       vers quelqu'un qui ne peut plus se connecter pour lire le message.
       Un compte SUSPENDU, lui, est prévenu — il garde la lecture, et
       c'est la décision du 2026-09-15. */
    if (recipient.is_deleted) return;

    const { data: authUser, error: authError } = await admin.auth.admin.getUserById(
      recipient.auth_user_id,
    );
    const to = authUser?.user?.email;
    if (authError || !to) return;

    const outcome = await sendEmail(
      composeNewMessageEmail({
        to,
        siteUrl,
        recipientName: recipient.full_name,
        senderName,
        body: message.body,
        productTitle: message.products?.title ?? null,
        conversationId: message.conversation_id,
      }),
    );

    /* Un email perdu ne doit pas rester invisible : c'est le seul canal
       qui ramène un commerçant, et personne ne s'apercevra de son absence
       en utilisant l'application. Il n'est pas non plus rejoué — un
       renvoi automatique sur une adresse invalide abîme la réputation du
       domaine. En v1, on constate ; on rejoue quand il y aura de quoi
       mesurer. */
    if (!outcome.sent && outcome.configured) {
      console.error(`[email] notification non envoyée (message ${messageId}) : ${outcome.reason}`);
    }
  } catch (cause) {
    /* Rien de ce qui se passe ici ne doit toucher l'envoi du message
       lui-même : il est déjà écrit en base, confirmé, et affiché. Une
       notification est un service rendu EN PLUS — la faire échouer
       bruyamment reviendrait à casser la messagerie parce que le
       courrier ne part pas. */
    console.error(`[email] notification impossible (message ${messageId}) :`, cause);
  }
}

/** Le texte de l'email. Séparé de l'envoi pour être relu — et modifié —
 * sans toucher au transport. */
function composeNewMessageEmail(input: {
  to: string;
  /** Résolue par l'appelant, et JAMAIS depuis l'en-tête `Host` : un email
   * est lu ailleurs, plus tard, et son lien doit désigner le vrai site
   * même si la requête qui l'a déclenché portait un `Host` falsifié. */
  siteUrl: string;
  recipientName: string;
  senderName: string;
  body: string;
  productTitle: string | null;
  conversationId: string;
}) {
  const link = `${input.siteUrl}/messages/${input.conversationId}`;

  /* Le message est recopié dans l'email plutôt que résumé par « vous avez
     un nouveau message ». Sur un forfait guinéen, obliger quelqu'un à
     ouvrir l'application pour découvrir « c'est disponible ? » lui coûte
     des données pour rien. Tronqué quand même : un email n'est pas
     l'écran du fil, et la suite est à un clic. */
  const excerpt = input.body.length > 400 ? `${input.body.slice(0, 400)}…` : input.body;
  const about = input.productTitle ? `À propos de : ${input.productTitle}` : "";

  const subject = `${input.senderName} vous a écrit sur Makiti`;

  const text = [
    `Bonjour ${input.recipientName},`,
    `${input.senderName} vous a envoyé un message sur Makiti.`,
    ...(about ? [about] : []),
    excerpt,
    `Répondre : ${link}`,
  ].join("\n\n");

  /* HTML volontairement pauvre : une table, pas de feuille de style
     externe, pas d'image. C'est ce que les clients mail rendent tous de
     la même façon, et ça reste lisible sur un téléphone d'entrée de
     gamme. Tout ce qui vient d'un humain passe par `escapeHtml`. */
  const html = `<!doctype html>
<html lang="fr">
  <body style="margin:0;padding:24px;background:#faf6f0;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;color:#2b2320;">
    <div style="max-width:520px;margin:0 auto;background:#ffffff;border:1px solid #e6ddd2;border-radius:12px;padding:24px;">
      <p style="margin:0 0 16px;">Bonjour ${escapeHtml(input.recipientName)},</p>
      <p style="margin:0 0 16px;"><strong>${escapeHtml(input.senderName)}</strong> vous a envoyé un message sur Makiti.</p>
      ${about ? `<p style="margin:0 0 16px;color:#6b5d52;font-size:14px;">${escapeHtml(about)}</p>` : ""}
      <blockquote style="margin:0 0 24px;padding:12px 16px;background:#faf6f0;border-left:3px solid #c1613a;white-space:pre-wrap;">${escapeHtml(excerpt)}</blockquote>
      <a href="${escapeHtml(link)}" style="display:inline-block;background:#c1613a;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600;">Répondre</a>
      <p style="margin:24px 0 0;color:#6b5d52;font-size:13px;">Vous recevez cet email parce que vous avez un compte Makiti et qu'un message vous attend.</p>
    </div>
  </body>
</html>`;

  return { to: input.to, subject, text, html };
}
