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
 * Retour vers un fil, en portant un message dans l'URL. Les lignes de la
 * feuille d'actions (écran 32) sont de vraies `<form>` de composants
 * serveur, sans `useActionState` : elles fonctionnent donc sans
 * JavaScript, et l'URL est le seul canal qui survive à la redirection.
 * Le fil affiche ensuite le message avec `Notice`.
 *
 * `iAmMerchant` vient de `getThreadContext`, que chaque appelant a déjà
 * interrogé. Sans lui, cette fonction renvoyait toujours sur `/messages` :
 * un commerçant qui bloquait quelqu'un depuis `/vendeur/messages/[id]`
 * ressortait donc dans l'espace CLIENT. La garde de `ThreadScreen` le
 * rattraperait — elle renvoie chaque fil vers son espace réel — mais au
 * prix d'une redirection de plus, et surtout d'une sortie d'espace
 * visible à l'écran. Une action ne fait pas changer d'espace.
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
 * message, ou un refus à MONTRER.
 *
 * Un simple `string` obligeait l'appelant à traiter tout refus comme une
 * panne : l'exception remontait à la frontière d'erreur, qui affiche
 * « Vérifiez votre connexion ». Le quota de 20 boutiques par jour
 * (décision 13 de docs/SPEC.md) est pourtant une règle, pas un incident —
 * et son message, écrit en français dans le trigger `check_conversation_
 * rate_limit` (0002, 3.4), existe précisément pour être lu par la
 * personne concernée.
 */
export type ConversationOutcome =
  | { kind: "ready"; conversationId: string }
  | { kind: "refused"; reason: string };

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
): Promise<ConversationOutcome> {
  const { data: existing, error: findError } = await supabase
    .from("conversations")
    .select("id")
    .eq("client_id", clientProfileId)
    .eq("merchant_id", merchantId)
    .maybeSingle();
  if (findError) throw findError;
  /* Le quota ne compte que les fils NOUVEAUX : quelqu'un qui a déjà écrit
     à cette boutique la retrouve toujours, même après vingt autres
     contacts dans la journée. C'est ce que dit le trigger (`before
     insert`), et l'ordre de ce code le respecte — chercher d'abord. */
  if (existing) return { kind: "ready", conversationId: existing.id };

  const { data: created, error: createError } = await supabase
    .from("conversations")
    .insert({ client_id: clientProfileId, merchant_id: merchantId })
    .select("id")
    .single();

  /* « Chercher puis créer » laisse une fenêtre entre les deux : deux
     requêtes parties presque en même temps — un double tap sur
     « Contacter », ou la page rouverte pendant que la première charge —
     ne trouvent ni l'une ni l'autre de fil, et tentent toutes deux de
     l'insérer. La base tient bon : `unique (client_id, merchant_id)`
     (0001) refuse la seconde, et c'est elle qui garantit vraiment le
     « un seul fil par couple », pas ce code.

     Ce qui manquait, c'est la suite : l'erreur 23505 remontait jusqu'à
     la frontière d'erreur, donc le deuxième tap affichait « Vérifiez
     votre connexion » alors que le fil venait précisément d'être créé.
     Une course perdue n'est pas un échec ici — le résultat voulu existe,
     il suffit de le relire. */
  if (createError) {
    /* P0001 = un `raise exception` d'un trigger. Sur une insertion dans
       `conversations`, il n'y en a qu'un : le quota de 20 par jour. Son
       texte est déjà écrit pour être lu tel quel (« Limite atteinte :
       20 nouvelles conversations par jour maximum. »), donc on le relaie
       sans le réécrire — le traduire deux fois, c'est se condamner à ce
       que les deux versions divergent.

       Aucune conversation n'est créée dans ce cas : le trigger s'exécute
       AVANT l'insertion. Le refus est donc complet, pas partiel. */
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
     refusé par le RLS lève une erreur, c'est la précision mesurée le
     2026-09-13 — mais parce que la notification a besoin de l'identifiant
     du message qui vient d'être créé. */
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
  /* Les refus des triggers (P0001) sont déjà rédigés en français et se
     relaient tels quels — c'est le commentaire ci-dessus. Le refus du
     RLS, lui, ne l'est pas : il dit « new row violates row-level
     security policy for table "messages" », une phrase écrite pour un
     développeur qui lit des journaux, pas pour quelqu'un qui vient de
     taper un message sur son téléphone.
     
     Trois causes possibles, et toutes veulent dire la même chose pour
     l'expéditeur : le fil ne prend plus d'écriture — l'autre m'a bloqué
     (0002, 6.7), mon compte est suspendu, ou la boutique en face l'est
     (0017). L'écran du fil affiche normalement l'explication AVANT la
     frappe ; ce message-ci ne sert qu'au cas où l'état a changé pendant
     qu'on écrivait, et il vaut mieux qu'il soit compréhensible. */
  if (error) {
    if (error.code === "42501") {
      return { error: "Ce fil n'accepte plus de nouveaux messages. Vos échanges restent consultables." };
    }
    return { error: error.message };
  }

  /* L'email part APRÈS la réponse, jamais pendant.
     `after` (Next 16, stable depuis 15.1) s'exécute une fois la réponse
     envoyée — y compris après le `redirect` ci-dessous, la documentation
     le garantit — et Vercel maintient l'invocation ouverte le temps
     qu'il finisse (`waitUntil`).

     Attendre Resend AVANT de rendre la main ferait payer à l'expéditeur,
     sur un réseau guinéen instable, l'aller-retour vers une API
     étrangère : son message est déjà en base, il n'a aucune raison de
     regarder un écran qui tourne. Et un Resend en panne retarderait ou
     casserait l'envoi d'un message qui, lui, a parfaitement réussi. */
  after(() => notifyNewMessage(inserted.id));

  backToThread(conversationId, context.iAmMerchant);
}

/** Bloquer mon interlocuteur — écran 32. Je ne peux désigner que MOI-MÊME
 * comme bloqueur (policy "conversations: je bloque mon interlocuteur") :
 * bloquer, ici, veut dire « je me protège », pas « je réduis l'autre au
 * silence dans l'absolu ». */
export async function blockPeerAction(formData: FormData) {
  const conversationId = String(formData.get("conversationId") ?? "");
  /* Formulaire malformé : aucun fil, donc aucun espace à déduire. On
     renvoie sur l'écran d'ouverture de la connexion — `/vendeur` pour un
     compte commerçant seul, `/` sinon — plutôt que sur `/messages`, qui
     aurait fait sortir un commerçant de son espace sur une erreur dont il
     n'est pas responsable. */
  if (!conversationId) redirect(await landingForSession(await createClient()));

  const supabase = await createClient();
  const context = await getThreadContext(supabase, conversationId);
  // Pas de contexte : le fil n'existe pas ou ne nous concerne pas. On ne
  // peut donc pas déduire l'espace — l'espace client est le seul repli
  // possible, et la garde de `ThreadScreen` corrigera si besoin.
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
 * Signaler une conversation — écran 32b.
 *
 * La maquette `design/SignalerConversation.dc.html` prévoit bien une
 * feuille de motifs, avec sa propre liste : on ne signale pas une
 * personne pour « photo trompeuse ». Le motif arrive donc de
 * la feuille « signaler » du fil, jamais d'un libellé figé — un signalement
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
  if (!conversationId) redirect(await landingForSession(await createClient()));

  const supabase = await createClient();
  const context = await getThreadContext(supabase, conversationId);
  if (!context) backToThread(conversationId, false, "Conversation introuvable.");

  // Contrôle du motif APRÈS la lecture du contexte, et pas avant : sans
  // le contexte, ce refus ne savait pas dans quel espace renvoyer.
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
