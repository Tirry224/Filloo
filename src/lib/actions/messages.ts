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

/**
 * Retour vers un fil, le message porté par l'URL : la feuille d'actions
 * (écran 32) utilise de vraies `<form>` serveur, qui marchent sans
 * JavaScript, et l'URL est le seul canal qui survive à la redirection.
 *
 * `iAmMerchant` vient de `getThreadContext` : sans lui, un commerçant qui
 * bloquait quelqu'un depuis son espace ressortait côté client. Une action
 * ne fait pas changer d'espace.
 */
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
 * Ce que répond « Contacter le vendeur » : un fil prêt à recevoir un
 * message, ou un refus à MONTRER. Un simple `string` faisait traiter tout
 * refus comme une panne (« Vérifiez votre connexion ») ; le quota de
 * 20 boutiques par jour (SPEC, décision 13) est une règle, pas un incident.
 */
export type ConversationOutcome =
  | { kind: "ready"; conversationId: string }
  | { kind: "refused"; reason: string };

/**
 * Ouvrir (ou retrouver) le fil avec une boutique — « Contacter le vendeur »
 * (écran 16/30). Appelée depuis le composant serveur de la page, pas depuis
 * un formulaire : SPEC ne prévoit qu'un seul écran d'interruption (le
 * compte). Un seul fil par couple (client, boutique) : `client_id`/
 * `merchant_id` cherchés d'abord, créés seulement si absents.
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
  /* Le quota ne compte que les fils NOUVEAUX (trigger `before insert`) :
     qui a déjà écrit à cette boutique la retrouve toujours. D'où l'ordre
     de ce code — chercher d'abord. */
  if (existing) return { kind: "ready", conversationId: existing.id };

  const { data: created, error: createError } = await supabase
    .from("conversations")
    .insert({ client_id: clientProfileId, merchant_id: merchantId })
    .select("id")
    .single();

  /* « Chercher puis créer » laisse une fenêtre : deux requêtes concurrentes
     (double tap sur « Contacter ») ne trouvent aucun fil et tentent toutes
     deux l'insertion. C'est `unique (client_id, merchant_id)` (0001), pas ce
     code, qui garantit le « un seul fil par couple ». Mais l'erreur 23505
     affichait « Vérifiez votre connexion » alors que le fil venait d'être
     créé : une course perdue n'est pas un échec, il suffit de relire. */
  if (createError) {
    /* P0001 = `raise exception` d'un trigger ; ici il n'y en a qu'un, le
       quota de 20 par jour. Son texte est déjà rédigé en français pour être
       lu tel quel : le relayer évite deux versions qui divergent. Le trigger
       étant `before insert`, le refus est complet, pas partiel. */
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
 * Envoyer un message — écran 30. Les messages d'erreur des triggers
 * (`0002_rules_and_security.sql`, section 3.4/3.4 bis) sont déjà écrits en
 * français pour être lus tels quels : « Limite atteinte : 100 messages par
 * jour maximum. », « Le premier message doit préciser le produit
 * concerné. » — on les relaie donc sans les traduire, contrairement aux
 * messages de `auth.ts` qui viennent de Supabase en anglais.
 */
export async function sendMessageAction(_prevState: ActionState | null, formData: FormData): Promise<ActionState> {
  const conversationId = String(formData.get("conversationId") ?? "");
  const body = String(formData.get("body") ?? "").trim();
  const productId = String(formData.get("productId") ?? "") || null;
  if (!conversationId || !body) return { error: "Écrivez un message avant d'envoyer." };

  const supabase = await createClient();
  const context = await getThreadContext(supabase, conversationId);
  if (!context) return { error: "Conversation introuvable." };

  /* `.select("id")` n'est pas là pour vérifier l'écriture — un `insert`
     refusé par le RLS lève une erreur — mais parce que la notification a
     besoin de l'identifiant du message créé. */
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
  /* Les refus de triggers (P0001) se relaient tels quels ; celui du RLS,
     non : « new row violates row-level security policy » est écrit pour un
     journal, pas pour quelqu'un qui vient de taper un message. Trois causes
     possibles, un seul sens pour l'expéditeur — le fil ne prend plus
     d'écriture : l'autre m'a bloqué (0002, 6.7), mon compte est suspendu, ou
     la boutique l'est (0017). L'écran affiche normalement l'explication
     avant la frappe ; ce message ne sert que si l'état a changé entre-temps. */
  if (error) {
    if (error.code === "42501") {
      return { error: "Ce fil n'accepte plus de nouveaux messages. Vos échanges restent consultables." };
    }
    return { error: error.message };
  }

  /* L'email part APRÈS la réponse, jamais pendant : `after` s'exécute une
     fois la réponse envoyée, y compris après le `redirect` ci-dessous, et
     Vercel garde l'invocation ouverte (`waitUntil`). Attendre Resend ferait
     payer à l'expéditeur, sur un réseau instable, l'aller-retour vers une
     API étrangère — et une panne Resend casserait un envoi qui a réussi. */
  after(() => notifyNewMessage(inserted.id));

  backToThread(conversationId, context.iAmMerchant);
}

/** Bloquer mon interlocuteur — écran 32. Je ne peux désigner que MOI-MÊME
 * comme bloqueur (policy "conversations: je bloque mon interlocuteur") :
 * bloquer, ici, veut dire « je me protège », pas « je réduis l'autre au
 * silence dans l'absolu ». */
export async function blockPeerAction(formData: FormData) {
  const conversationId = String(formData.get("conversationId") ?? "");
  /* Formulaire malformé : aucun fil, donc aucun espace à déduire. Repli sur
     l'écran d'ouverture (`/vendeur` ou `/`) plutôt que `/messages`, qui
     ferait sortir un commerçant de son espace. */
  if (!conversationId) redirect(await landingForSession(await createClient()));

  const supabase = await createClient();
  const context = await getThreadContext(supabase, conversationId);
  // Pas de contexte : espace indéductible, repli côté client ; la garde de
  // `ThreadScreen` corrigera si besoin.
  if (!context) backToThread(conversationId, false, "Conversation introuvable.");

  const { data, error } = await supabase
    .from("conversations")
    .update({ blocked_by: context.myParticipantId })
    .eq("id", conversationId)
    .select("id");

  // Même raison que les actions produit : le RLS ne renvoie pas d'erreur
  // quand il écarte une ligne, il renvoie un succès portant zéro ligne.
  // « Bloquer » est exactement le genre d'action qu'il ne faut pas croire
  // faite sans preuve — quelqu'un compte dessus pour ne plus être
  // contacté.
  if (error) backToThread(conversationId, context.iAmMerchant, error.message);
  if (!data || data.length === 0) backToThread(conversationId, context.iAmMerchant, "Blocage impossible. Réessayez.");
  backToThread(conversationId, context.iAmMerchant);
}

/**
 * Signaler une conversation — écran 32b. Le motif vient de la feuille
 * « signaler » du fil, avec sa propre liste (on ne signale pas une personne
 * pour « photo trompeuse ») : sans motif, l'équipe doit relire tout le fil
 * pour deviner le reproche. Les précisions facultatives sont recollées au
 * motif, `reports.reason` étant du texte libre.
 */
export async function reportConversationAction(formData: FormData) {
  const conversationId = String(formData.get("conversationId") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  const details = String(formData.get("details") ?? "").trim();
  if (!conversationId) redirect(await landingForSession(await createClient()));

  const supabase = await createClient();
  const context = await getThreadContext(supabase, conversationId);
  if (!context) backToThread(conversationId, false, "Conversation introuvable.");

  // Contrôle du motif APRÈS la lecture du contexte : sans lui, ce refus ne
  // sait pas dans quel espace renvoyer.
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

  // Un signalement avalé en silence est pire qu'un bouton absent : la
  // personne croit l'équipe prévenue. Le RLS, lui, n'est pas silencieux (un
  // `with check` qui échoue lève une erreur) ; le `.select("id")` couvre
  // l'autre cas, un trigger `before insert` qui renvoie NULL et écarte la
  // ligne sans erreur.
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

  /* Signaler un produit ne confirmait rien : la feuille se refermait et la
     fiche réapparaissait à l'identique, sans distinguer « c'est parti » de
     « ça n'a pas marché ». Deux écrans qui font la même chose rendent compte
     de la même façon : le même `?info=` que le fil, lu par la fiche. */
  redirect(`/produit/${productId}?info=${encodeURIComponent("Signalement envoyé. Notre équipe va examiner ce produit.")}`);
}
