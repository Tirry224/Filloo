"use server";

import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getMyProfiles } from "@/lib/data/session";
import { getThreadContext } from "@/lib/data/messages";
import type { ActionState } from "@/lib/actions/auth";
import type { Database } from "@/lib/database.types";

/**
 * Retour vers un fil, en portant un message dans l'URL. Les lignes de la
 * feuille d'actions (écran 32) sont de vraies `<form>` de composants
 * serveur, sans `useActionState` : elles fonctionnent donc sans
 * JavaScript, et l'URL est le seul canal qui survive à la redirection.
 * `/messages/[id]` affiche le message avec `Notice`.
 */
function backToThread(conversationId: string, errorMessage?: string, successMessage?: string): never {
  const params = new URLSearchParams();
  if (errorMessage) params.set("erreur", errorMessage);
  if (successMessage) params.set("info", successMessage);
  const query = params.toString();
  redirect(`/messages/${conversationId}${query ? `?${query}` : ""}`);
}

/**
 * Ouvrir (ou retrouver) le fil avec une boutique — depuis « Contacter le
 * vendeur » (écran 16/30). Appelée directement depuis le composant serveur
 * de la page, pas depuis un formulaire : il n'y a pas de geste
 * intermédiaire entre le clic sur « Contacter » et l'ouverture du fil,
 * volontairement — SPEC ne prévoit qu'un seul écran d'interruption
 * (le compte), pas un second pour la conversation elle-même. Un seul fil
 * par couple (client, boutique) : `client_id`/`merchant_id` cherchés
 * d'abord, créés seulement si absents.
 */
export async function findOrCreateConversation(
  supabase: SupabaseClient<Database>,
  clientProfileId: string,
  merchantId: string,
): Promise<string> {
  const { data: existing, error: findError } = await supabase
    .from("conversations")
    .select("id")
    .eq("client_id", clientProfileId)
    .eq("merchant_id", merchantId)
    .maybeSingle();
  if (findError) throw findError;
  if (existing) return existing.id;

  const { data: created, error: createError } = await supabase
    .from("conversations")
    .insert({ client_id: clientProfileId, merchant_id: merchantId })
    .select("id")
    .single();
  if (createError) throw createError;
  return created.id;
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

  const { error } = await supabase.from("messages").insert({
    conversation_id: conversationId,
    sender_id: context.myParticipantId,
    body,
    product_id: productId,
  });
  if (error) return { error: error.message };

  redirect(`/messages/${conversationId}`);
}

/** Bloquer mon interlocuteur — écran 32. Je ne peux désigner que MOI-MÊME
 * comme bloqueur (policy "conversations: je bloque mon interlocuteur") :
 * bloquer, ici, veut dire « je me protège », pas « je réduis l'autre au
 * silence dans l'absolu ». */
export async function blockPeerAction(formData: FormData) {
  const conversationId = String(formData.get("conversationId") ?? "");
  if (!conversationId) redirect("/messages");

  const supabase = await createClient();
  const context = await getThreadContext(supabase, conversationId);
  if (!context) backToThread(conversationId, "Conversation introuvable.");

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
  if (error) backToThread(conversationId, error.message);
  if (!data || data.length === 0) backToThread(conversationId, "Blocage impossible. Réessayez.");
  backToThread(conversationId);
}

/**
 * Signaler une conversation — écran 32b.
 *
 * La maquette `design/SignalerConversation.dc.html` prévoit bien une
 * feuille de motifs, avec sa propre liste : on ne signale pas une
 * personne pour « photo trompeuse ». Le motif arrive donc de
 * `/messages/[id]/signaler`, jamais d'un libellé figé — un signalement
 * sans motif oblige l'équipe à relire tout le fil pour deviner le
 * reproche, ce qui revient à ne pas traiter le signalement.
 *
 * Les précisions facultatives sont recollées au motif : `reports.reason`
 * est une colonne de texte libre, et une deuxième colonne pour trois
 * lignes de contexte ne vaut pas une migration.
 */
export async function reportConversationAction(formData: FormData) {
  const conversationId = String(formData.get("conversationId") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  const details = String(formData.get("details") ?? "").trim();
  if (!conversationId) redirect("/messages");
  if (!reason) backToThread(conversationId, "Choisissez un motif de signalement.");

  const supabase = await createClient();
  const context = await getThreadContext(supabase, conversationId);
  if (!context) backToThread(conversationId, "Conversation introuvable.");

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
  // personne croit l'équipe prévenue et n'en reparle jamais.
  //
  // Précision mesurée le 2026-09-13 sur un PostgreSQL local, parce que ce
  // commentaire a d'abord porté une explication FAUSSE : un `insert`
  // refusé par le RLS n'est PAS silencieux. Un `with check` qui échoue
  // lève « new row violates row-level security policy », donc `error`
  // suffisait déjà ici. Le succès muet à zéro ligne est le propre des
  // `update` et `delete`, dont le `using` filtre des lignes au lieu de
  // refuser une valeur.
  //
  // Le `.select("id")` reste, pour la seule raison qui tienne : un
  // trigger `before insert` qui renvoie NULL écarte la ligne SANS erreur
  // (vérifié de la même façon). Aucun trigger du projet ne le fait
  // aujourd'hui, mais une écriture qui sait ce qu'elle a écrit ne dépend
  // pas de cette promesse.
  if (error) backToThread(conversationId, error.message);
  if (!data || data.length === 0) {
    backToThread(conversationId, "Signalement impossible. Reconnectez-vous, puis réessayez.");
  }
  backToThread(conversationId, undefined, "Signalement envoyé. Notre équipe va lire cette conversation.");
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

  /* Signaler une conversation confirmait (« Signalement envoyé. Notre
     équipe va lire cette conversation. »), signaler un produit non : la
     feuille se refermait et la fiche réapparaissait à l'identique, sans
     rien distinguer « c'est parti » de « ça n'a pas marché ». Le code
     vérifiait pourtant l'écriture juste au-dessus — le résultat était
     mesuré côté serveur puis jeté avant d'arriver à l'écran.

     Deux écrans qui font la même chose ne peuvent pas rendre compte
     différemment : le même `?info=` que le fil, lu par la fiche. */
  redirect(`/produit/${productId}?info=${encodeURIComponent("Signalement envoyé. Notre équipe va examiner ce produit.")}`);
}
