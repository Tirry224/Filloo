"use server";

import { redirect } from "next/navigation";
import { after } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getMyProfiles, landingForSession } from "@/lib/data/session";
import { getThreadContext } from "@/lib/data/messages";
import { messagesBase } from "@/lib/espace";
import { notifyNewMessage } from "@/lib/notifications";
import type { ActionState } from "@/lib/actions/auth";
import type { Database } from "@/lib/database.types";
import { compter } from "@/lib/analytics";

/** Retour vers un fil, le message porté par l'URL (même raison que
 * `backToSeller`). `iAmMerchant` vient de `getThreadContext` : une action
 * ne fait pas changer d'espace. */
function backToThread(
  conversationId: string,
  iAmMerchant: boolean,
  errorMessage?: string,
  successMessage?: string,
): never {
  const params = new URLSearchParams();
  if (errorMessage) params.set("erreur", errorMessage);
  if (successMessage) params.set("info", successMessage);
  const query = params.toString();
  const base = messagesBase(iAmMerchant ? "merchant" : "client");
  redirect(`${base}/${conversationId}${query ? `?${query}` : ""}`);
}

/**
 * Un fil prêt à recevoir un message, ou un refus à MONTRER : le quota de
 * 20 boutiques par jour (SPEC, décision 13) est une règle, pas une panne,
 * et ne doit pas s'afficher comme telle.
 */
export type ConversationOutcome =
  | { kind: "ready"; conversationId: string }
  | { kind: "refused"; reason: string };

/**
 * Ouvrir ou retrouver le fil avec une boutique — « Contacter le vendeur »
 * (écran 16/30). Appelée depuis le composant serveur de la page et non
 * depuis un formulaire : SPEC ne prévoit qu'un seul écran d'interruption.
 * Un seul fil par couple (client, boutique).
 */
export async function findOrCreateConversation(
  supabase: SupabaseClient<Database>,
  clientProfileId: string,
  merchantId: string,
): Promise<ConversationOutcome> {
  const { data: existing, error: findError } = await supabase
    .from("conversations")
    .select("id")
    .eq("client_id", clientProfileId)
    .eq("merchant_id", merchantId)
    .maybeSingle();
  if (findError) throw findError;
  // Le quota ne compte que les fils NOUVEAUX (trigger `before insert`) :
  // chercher d'abord, pour que qui a déjà écrit retrouve toujours son fil.
  if (existing) return { kind: "ready", conversationId: existing.id };

  const { data: created, error: createError } = await supabase
    .from("conversations")
    .insert({ client_id: clientProfileId, merchant_id: merchantId })
    .select("id")
    .single();

  /* « Chercher puis créer » laisse une fenêtre : un double tap tente deux
     insertions. C'est `unique (client_id, merchant_id)` (0001), pas ce
     code, qui garantit un seul fil par couple ; une course perdue (23505)
     n'est pas un échec, il suffit de relire. */
  /* `contact_abouti` se pose ICI, sur la branche qui CRÉE le fil, et
     jamais sur celle qui en retrouve un existant : compter les deux
     ferait remonter le taux de conversion à chaque fois qu'un client
     rouvre une discussion commencée la semaine dernière. */
  if (!createError) compter("contact_abouti", { role: "client", merchantId });

  if (createError) {
    /* P0001 = `raise exception` d'un trigger ; ici le quota de 20 par
       jour, dont le texte français se relaie tel quel. `before insert`,
       donc le refus est complet. */
    if (createError.code === "P0001") return { kind: "refused", reason: createError.message };
    if (createError.code !== "23505") throw createError;
    const { data: raced, error: raceError } = await supabase
      .from("conversations")
      .select("id")
      .eq("client_id", clientProfileId)
      .eq("merchant_id", merchantId)
      .maybeSingle();
    if (raceError) throw raceError;
    if (!raced) throw createError;
    return { kind: "ready", conversationId: raced.id };
  }
  return { kind: "ready", conversationId: created.id };
}

/**
 * Envoyer un message — écran 30. Les messages des triggers
 * (`0002_rules_and_security.sql`, 3.4/3.4 bis) sont déjà rédigés en
 * français et se relaient tels quels, contrairement à ceux de `auth.ts`.
 */
export async function sendMessageAction(_prevState: ActionState | null, formData: FormData): Promise<ActionState> {
  const conversationId = String(formData.get("conversationId") ?? "");
  const body = String(formData.get("body") ?? "").trim();
  const productId = String(formData.get("productId") ?? "") || null;
  if (!conversationId || !body) return { error: "Écrivez un message avant d'envoyer." };

  const supabase = await createClient();
  const context = await getThreadContext(supabase, conversationId);
  if (!context) return { error: "Conversation introuvable." };

  // `.select("id")` sert à la notification, pas au contrôle : un `insert`
  // refusé par le RLS lève une erreur.
  const { data: inserted, error } = await supabase
    .from("messages")
    .insert({
      conversation_id: conversationId,
      sender_id: context.myParticipantId,
      body,
      product_id: productId,
    })
    .select("id")
    .single();
  /* Le refus du RLS ne se relaie pas tel quel : ses trois causes — bloqué
     (0002, 6.7), compte suspendu, boutique suspendue (0017) — ont un seul
     sens pour l'expéditeur, le fil ne prend plus d'écriture. L'écran le dit
     normalement avant la frappe ; ce message couvre le changement d'état
     entre-temps. */
  if (error) {
    if (error.code === "42501") {
      return { error: "Ce fil n'accepte plus de nouveaux messages. Vos échanges restent consultables." };
    }
    return { error: error.message };
  }

  /* L'email part APRÈS la réponse : `after` s'exécute une fois celle-ci
     envoyée, redirect compris. Attendre Resend ferait payer l'aller-retour
     à l'expéditeur, et une panne Resend casserait un envoi réussi. */
  after(() => notifyNewMessage(inserted.id));

  /* Le CONTENU du message n'est jamais écrit dans la mesure (0024) : seul
     compte qu'un message soit parti, et de quel côté. C'est ce qui dit si
     les commerçants répondent — la question qui décide de la survie d'une
     place de marché de mise en relation. */
  compter("message_envoye", { role: context.iAmMerchant ? "merchant" : "client" });

  backToThread(conversationId, context.iAmMerchant);
}

/** Bloquer mon interlocuteur — écran 32. Je ne peux désigner que MOI-MÊME
 * comme bloqueur (policy "conversations: je bloque mon interlocuteur") :
 * bloquer veut dire « je me protège », pas « je le fais taire ». */
export async function blockPeerAction(formData: FormData) {
  const conversationId = String(formData.get("conversationId") ?? "");
  // Aucun fil, donc aucun espace à déduire : repli sur l'écran d'ouverture
  // plutôt que `/messages`, qui sortirait un commerçant de son espace.
  if (!conversationId) redirect(await landingForSession(await createClient()));

  const supabase = await createClient();
  const context = await getThreadContext(supabase, conversationId);
  // Espace indéductible : repli côté client, la garde de `ThreadScreen`
  // corrigera si besoin.
  if (!context) backToThread(conversationId, false, "Conversation introuvable.");

  const { data, error } = await supabase
    .from("conversations")
    .update({ blocked_by: context.myParticipantId })
    .eq("id", conversationId)
    .select("id");

  // Le RLS écarte une ligne par un succès à zéro ligne, sans erreur. On ne
  // croit pas un blocage fait sans preuve : quelqu'un compte dessus.
  if (error) backToThread(conversationId, context.iAmMerchant, error.message);
  if (!data || data.length === 0) backToThread(conversationId, context.iAmMerchant, "Blocage impossible. Réessayez.");
  backToThread(conversationId, context.iAmMerchant);
}

/**
 * Signaler une conversation — écran 32b. La feuille a sa propre liste de
 * motifs (on ne signale pas une personne pour « photo trompeuse ») : sans
 * motif, l'équipe doit relire tout le fil. Les précisions facultatives
 * sont recollées au motif, `reports.reason` étant du texte libre.
 */
export async function reportConversationAction(formData: FormData) {
  const conversationId = String(formData.get("conversationId") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  const details = String(formData.get("details") ?? "").trim();
  if (!conversationId) redirect(await landingForSession(await createClient()));

  const supabase = await createClient();
  const context = await getThreadContext(supabase, conversationId);
  if (!context) backToThread(conversationId, false, "Conversation introuvable.");

  // Après la lecture du contexte : sans lui, ce refus ne sait pas dans
  // quel espace renvoyer.
  if (!reason) backToThread(conversationId, context.iAmMerchant, "Choisissez un motif de signalement.");

  const { data, error } = await supabase
    .from("reports")
    .insert({
      reporter_id: context.myParticipantId,
      target_type: "conversation",
      target_id: conversationId,
      reason: details ? `${reason} — ${details}` : reason,
    })
    .select("id");

  // Un signalement avalé en silence est pire qu'un bouton absent. Le RLS
  // lève bien une erreur ici ; le `.select("id")` couvre l'autre cas, un
  // trigger `before insert` qui renvoie NULL sans erreur.
  if (error) backToThread(conversationId, context.iAmMerchant, error.message);
  if (!data || data.length === 0) {
    backToThread(conversationId, context.iAmMerchant, "Signalement impossible. Reconnectez-vous, puis réessayez.");
  }
  backToThread(conversationId, context.iAmMerchant, undefined, "Signalement envoyé. Notre équipe va lire cette conversation.");
}

/** Signaler un produit — écran 10. N'importe lequel de mes profils actifs
 * convient : "reports: je signale" ne distingue pas le rôle. */
export async function reportProductAction(_prevState: ActionState | null, formData: FormData): Promise<ActionState> {
  const productId = String(formData.get("productId") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  const details = String(formData.get("details") ?? "").trim();
  const fullReason = details ? `${reason} — ${details}` : reason;
  if (!productId || fullReason.length < 3) return { error: "Choisissez un motif." };

  const supabase = await createClient();
  const profiles = await getMyProfiles(supabase);
  const reporter = profiles.find((p) => !p.isSuspended && !p.isDeleted);
  if (!reporter) return { error: "Vous devez être connecté pour signaler un produit." };

  const { data, error } = await supabase
    .from("reports")
    .insert({
      reporter_id: reporter.id,
      target_type: "product",
      target_id: productId,
      reason: fullReason,
    })
    .select("id");
  if (error) return { error: error.message };
  // Même raison que le signalement d'une conversation, juste au-dessus.
  if (!data || data.length === 0) {
    return { error: "Signalement impossible. Reconnectez-vous, puis réessayez." };
  }

  // Même `?info=` que le fil : deux écrans qui font la même chose rendent
  // compte de la même façon.
  redirect(`/produit/${productId}?info=${encodeURIComponent("Signalement envoyé. Notre équipe va examiner ce produit.")}`);
}
