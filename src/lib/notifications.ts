import { createAdminClient } from "@/lib/supabase/admin";
import { emailButton, emailFooter, emailShell, escapeHtml, sendEmail } from "@/lib/email";
import { sendPushToUser } from "@/lib/push";
import { siteUrl as adresseDuSite } from "@/lib/site-url";
import { messagesBase } from "@/lib/espace";

/**
 * `service_role` parce que l'adresse vit dans `auth.users`, hors RLS.
 * L'expéditeur ne doit JAMAIS obtenir l'email de son interlocuteur : elle
 * est lue ici et ne repart vers aucun écran.
 */
export async function notifyNewMessage(messageId: string): Promise<void> {
  try {
    const emailPret = Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
    const pushPret = Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);

    /* Sans adresse de site, le lien de l'email serait relatif, donc mort
       dans une boîte mail. Le push n'en a pas besoin : son lien s'ouvre
       dans l'application. */
    const siteUrl = adresseDuSite();
    if (emailPret && !siteUrl) {
      console.error(
        "[email] Aucune adresse de site (ni NEXT_PUBLIC_SITE_URL, ni VERCEL_PROJECT_PRODUCTION_URL) : email non envoyé.",
      );
    }
    const emailPossible = emailPret && Boolean(siteUrl);

    if (!emailPossible && !pushPret) {
      console.error(
        "[notification] Ni push (NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY) ni email (RESEND_API_KEY, EMAIL_FROM) configuré : aucun avertissement envoyé.",
      );
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
    if (messageError || !message) {
      console.error(`[notification] message ${messageId} illisible :`, messageError?.message);
      return;
    }

    /* Le push part à chaque message ; l'email seulement pour le premier non
       lu du fil, sinon il mène au courrier indésirable. `read_at` se pose à
       l'ouverture du fil, et le suivant redevient notifiable par email. */
    const { count: alreadyWaiting, error: countError } = await admin
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("conversation_id", message.conversation_id)
      .eq("sender_id", message.sender_id)
      .is("read_at", null)
      .neq("id", message.id);
    if (countError) {
      console.error(`[notification] comptage impossible (message ${messageId}) :`, countError.message);
      return;
    }
    const emailDu = (alreadyWaiting ?? 0) === 0;

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
    if (conversationError || !conversation?.merchants) {
      console.error(`[notification] fil introuvable (message ${messageId}) :`, conversationError?.message);
      return;
    }

    const merchantProfileId = conversation.merchants.profile_id;
    const senderIsMerchant = message.sender_id === merchantProfileId;
    const recipientProfileId = senderIsMerchant ? conversation.client_id : merchantProfileId;
    const threadPath = `${messagesBase(senderIsMerchant ? "client" : "merchant")}/${message.conversation_id}`;
    const senderName = senderIsMerchant
      ? conversation.merchants.shop_name
      : (conversation.profiles?.full_name ?? "Un client");

    const { data: recipient, error: recipientError } = await admin
      .from("profiles")
      .select("auth_user_id, full_name, is_deleted")
      .eq("id", recipientProfileId)
      .single();
    if (recipientError || !recipient) {
      console.error(`[notification] destinataire introuvable (message ${messageId}) :`, recipientError?.message);
      return;
    }
    // Un compte supprimé est banni côté `auth.users` : il ne peut plus se
    // connecter pour lire. Un compte SUSPENDU, lui, garde la lecture.
    if (recipient.is_deleted) return;


    /* Le push d'abord : il arrive en secondes et ne lève jamais, donc
       n'empêche pas l'email qui suit. Il ne dit pas le corps du message —
       un écran verrouillé se lit par-dessus l'épaule, une boîte mail
       demande de déverrouiller. */
    if (pushPret) {
      await sendPushToUser(recipient.auth_user_id, {
        titre: senderName,
        corps: message.products?.title
          ? `Nouveau message à propos de : ${message.products.title}`
          : "Vous avez un nouveau message.",
        url: threadPath,
        // Un `tag` par conversation : la nouvelle remplace la précédente
        // au lieu d'en empiler dix.
        tag: `conversation-${message.conversation_id}`,
      });
    }

    /* `!siteUrl` est redondant avec `emailPossible` pour un lecteur, mais
       pas pour TypeScript, qui ne suit pas la déduction à travers un
       booléen intermédiaire. L'écrire ici plutôt que de forcer le type
       plus bas : un `!` non nul se contente de faire taire l'analyse. */
    if (!emailDu || !emailPossible || !siteUrl) return;

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
        threadPath,
      }),
    );

    if (!outcome.sent && outcome.configured) {
      console.error(`[email] notification non envoyée (message ${messageId}) : ${outcome.reason}`);
    }
  } catch (cause) {
    console.error(`[email] notification impossible (message ${messageId}) :`, cause);
  }
}

function composeNewMessageEmail(input: {
  to: string;
  /** Résolue par l'appelant, JAMAIS depuis l'en-tête `Host` : le lien doit
   * désigner le vrai site même si la requête portait un `Host` falsifié. */
  siteUrl: string;
  recipientName: string;
  senderName: string;
  body: string;
  productTitle: string | null;
  threadPath: string;
}) {
  const link = `${input.siteUrl}${input.threadPath}`;

  const excerpt = input.body.length > 400 ? `${input.body.slice(0, 400)}…` : input.body;
  const about = input.productTitle ? `À propos de : ${input.productTitle}` : "";

  const subject = `${input.senderName} vous a écrit sur Filloo`;

  const text = [
    `Bonjour ${input.recipientName},`,
    `${input.senderName} vous a envoyé un message sur Filloo.`,
    ...(about ? [about] : []),
    excerpt,
    `Répondre : ${link}`,
  ].join("\n\n");

  // Enveloppe commune aux quatre emails du projet (`emailShell`). Tout ce
  // qui vient d'un humain passe par `escapeHtml`.
  const html = emailShell(`      <p style="margin:0 0 16px;">Bonjour ${escapeHtml(input.recipientName)},</p>
      <p style="margin:0 0 16px;"><strong>${escapeHtml(input.senderName)}</strong> vous a envoyé un message sur Filloo.</p>
      ${about ? `<p style="margin:0 0 16px;color:#6b5d52;font-size:14px;">${escapeHtml(about)}</p>` : ""}
      <blockquote style="margin:0 0 24px;padding:12px 16px;background:#faf6f0;border-left:3px solid #c1613a;white-space:pre-wrap;">${escapeHtml(excerpt)}</blockquote>
      ${emailButton(link, "Répondre")}
      ${emailFooter("Vous recevez cet email parce que vous avez un compte Filloo et qu'un message vous attend.")}`);

  return { to: input.to, subject, text, html };
}
