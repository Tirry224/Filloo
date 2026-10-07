import { createAdminClient } from "@/lib/supabase/admin";
import { sendPushToUser } from "@/lib/push";
import { messagesBase } from "@/lib/espace";

/**
 * Prévenir le destinataire d'un nouveau message, PAR NOTIFICATION
 * SEULEMENT : sur son téléphone (app mobile, 0035) et dans son navigateur
 * abonné (0023).
 *
 * Plus d'email depuis le 2026-10-07 : décision du porteur du projet, qui
 * veut des notifications « comme une vraie application » et réserve
 * l'email au compte (confirmation d'adresse, mot de passe oublié). Un
 * utilisateur du site sans notifications activées n'est donc prévenu de
 * rien : c'est assumé.
 *
 * `service_role` parce que les appareils du destinataire ne sont lisibles
 * que par lui (RLS), alors que l'envoi est déclenché par l'expéditeur.
 */
export async function notifyNewMessage(messageId: string): Promise<void> {
  try {
    const admin = createAdminClient();

    const { data: message, error: messageError } = await admin
      .from("messages")
      .select("id, conversation_id, sender_id, products(title)")
      .eq("id", messageId)
      .single<{ id: string; conversation_id: string; sender_id: string; products: { title: string } | null }>();
    if (messageError || !message) {
      console.error(`[notification] message ${messageId} illisible :`, messageError?.message);
      return;
    }

    const [{ data: conversation, error: conversationError }, { count: nombreDeMessages }] = await Promise.all([
      admin
        .from("conversations")
        .select("client_id, merchants(profile_id, shop_name), profiles!conversations_client_id_fkey(full_name)")
        .eq("id", message.conversation_id)
        .single<{
          client_id: string;
          merchants: { profile_id: string; shop_name: string } | null;
          profiles: { full_name: string } | null;
        }>(),
      admin.from("messages").select("id", { count: "exact", head: true }).eq("conversation_id", message.conversation_id),
    ]);
    if (conversationError || !conversation?.merchants) {
      console.error(`[notification] fil introuvable (message ${messageId}) :`, conversationError?.message);
      return;
    }

    const merchantProfileId = conversation.merchants.profile_id;
    const senderIsMerchant = message.sender_id === merchantProfileId;
    const recipientProfileId = senderIsMerchant ? conversation.client_id : merchantProfileId;
    const threadPath = `${messagesBase(senderIsMerchant ? "client" : "merchant")}/${message.conversation_id}`;
    const senderName = senderIsMerchant ? conversation.merchants.shop_name : (conversation.profiles?.full_name ?? "Un client");

    const { data: recipient, error: recipientError } = await admin
      .from("profiles")
      .select("auth_user_id, is_deleted")
      .eq("id", recipientProfileId)
      .single();
    if (recipientError || !recipient) {
      console.error(`[notification] destinataire introuvable (message ${messageId}) :`, recipientError?.message);
      return;
    }
    // Un compte supprimé ne peut plus se connecter pour lire. Un compte
    // SUSPENDU, lui, garde la lecture : il est prévenu.
    if (recipient.is_deleted) return;

    /* Le premier message d'un fil est, pour le commerçant, une NOUVELLE
       DEMANDE : c'est ce qu'il doit voir en premier sur son écran.
       Le corps du message ne part jamais : un écran verrouillé se lit
       par-dessus l'épaule. */
    const nouvelleDemande = !senderIsMerchant && nombreDeMessages === 1;
    const produit = message.products?.title;
    await sendPushToUser(recipient.auth_user_id, {
      titre: nouvelleDemande ? `Nouvelle demande de ${senderName}` : senderName,
      corps: produit
        ? nouvelleDemande
          ? `À propos de : ${produit}`
          : `Nouveau message à propos de : ${produit}`
        : "Vous avez un nouveau message.",
      url: threadPath,
      // Un `tag` par conversation : la nouvelle remplace la précédente au
      // lieu d'en empiler dix.
      tag: `conversation-${message.conversation_id}`,
    });
  } catch (cause) {
    console.error(`[notification] impossible (message ${messageId}) :`, cause);
  }
}
