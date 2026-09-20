import { createAdminClient } from "@/lib/supabase/admin";
import { emailButton, emailFooter, emailShell, escapeHtml, sendEmail } from "@/lib/email";
import { sendPushToUser } from "@/lib/push";

/**
 * Prévenir la personne qui vient de recevoir un message, par notification
 * push ET par email. Sans ça, la messagerie est une boîte aux lettres que
 * personne ne relève, et tout le produit repose dessus.
 *
 * `service_role` parce que l'adresse vit dans `auth.users`, hors RLS : et
 * c'est heureux, l'expéditeur ne doit JAMAIS pouvoir obtenir l'email de son
 * interlocuteur, ce serait contourner la messagerie interne. L'adresse est
 * lue ici et ne repart vers aucun écran.
 *
 * Ni trigger en base ni Edge Function : une action serveur fait la même
 * chose avec un aller-retour de moins et un seul système à déployer.
 */
export async function notifyNewMessage(messageId: string): Promise<void> {
  try {
    /* DEUX CANAUX, DEUX CONFIGURATIONS, UNE SEULE RÈGLE D'ENVOI. Chacun
       peut être éteint sans empêcher l'autre ; ce qu'ils partagent, c'est
       qui prévenir et la règle anti-spam. La dupliquer, c'est se garantir
       qu'un jour l'une enverra ce que
       l'autre retient. */
    const emailPret = Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
    const pushPret = Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);

    /* Sans adresse de site, le lien de l'email serait relatif — donc mort
       dans une boîte mail. Un email qui annonce un message et ne permet
       pas d'y aller est pire que pas d'email : il fait ouvrir, chercher,
       et abandonner. Le push, lui, n'en a pas besoin : son lien est
       relatif et s'ouvre dans l'application, jamais dans une boîte mail. */
    const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/+$/, "");
    if (emailPret && !siteUrl) {
      console.error("[email] NEXT_PUBLIC_SITE_URL absente : email non envoyé.");
    }
    const emailPossible = emailPret && Boolean(siteUrl);

    /* On s'arrête AVANT les requêtes ci-dessous si RIEN ne peut partir :
       une fonctionnalité éteinte ne doit pas coûter quatre allers-retours
       en base par message envoyé. */
    if (!emailPossible && !pushPret) return;

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

    /* LA RÈGLE ANTI-SPAM, ET ELLE NE COÛTE AUCUNE COLONNE. On ne prévient
       que si ce message est le premier non lu du fil : s'il en reste un du
       même expéditeur, le destinataire a déjà été prévenu et n'est pas
       revenu. Un second avertissement ne l'informe de rien et mène au
       courrier indésirable, après quoi plus AUCUNE notification n'arrive.
       Dix messages échangés produisent donc un seul email ; `read_at` se
       pose à l'ouverture du fil et le suivant redevient notifiable.
       Tout tient sur cette colonne, qui existe depuis 0001. */
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


    /* LE PUSH D'ABORD : il arrive en secondes sur un écran verrouillé,
       l'email met le temps qu'il met, et il ne lève jamais — il ne peut
       donc pas empêcher l'email qui suit.

       CE QU'IL NE DIT PAS : le corps du message. Un écran verrouillé se lit
       par-dessus l'épaule ; l'email, lui, demande de déverrouiller son
       téléphone. Deux expositions, deux
       contenus. */
    if (pushPret) {
      await sendPushToUser(recipient.auth_user_id, {
        titre: senderName,
        corps: message.products?.title
          ? `Nouveau message à propos de : ${message.products.title}`
          : "Vous avez un nouveau message.",
        url: `/messages/${message.conversation_id}`,
        /* Un `tag` par CONVERSATION : deux messages du même fil
           remplacent la notification précédente au lieu d'en empiler
           dix. */
        tag: `conversation-${message.conversation_id}`,
      });
    }

    if (!emailPossible) return;

    /* L'ADRESSE N'EST CHERCHÉE QU'ICI : avant le push, un compte sans
       adresse lisible supprimait AUSSI la notification, qui n'en a aucun
       besoin. Un canal ne doit jamais tomber à cause de la configuration
       d'un autre. */
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

  /* L'enveloppe est celle de `emailShell` — la même pour les quatre
     emails du projet. Un email transactionnel qui ne ressemble pas aux
     autres emails du même domaine ressemble surtout à une tentative
     d'hameçonnage. Tout ce qui vient d'un humain passe par
     `escapeHtml`. */
  const html = emailShell(`      <p style="margin:0 0 16px;">Bonjour ${escapeHtml(input.recipientName)},</p>
      <p style="margin:0 0 16px;"><strong>${escapeHtml(input.senderName)}</strong> vous a envoyé un message sur Makiti.</p>
      ${about ? `<p style="margin:0 0 16px;color:#6b5d52;font-size:14px;">${escapeHtml(about)}</p>` : ""}
      <blockquote style="margin:0 0 24px;padding:12px 16px;background:#faf6f0;border-left:3px solid #c1613a;white-space:pre-wrap;">${escapeHtml(excerpt)}</blockquote>
      ${emailButton(link, "Répondre")}
      ${emailFooter("Vous recevez cet email parce que vous avez un compte Makiti et qu'un message vous attend.")}`);

  return { to: input.to, subject, text, html };
}
