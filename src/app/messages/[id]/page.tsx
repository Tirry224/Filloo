import { notFound } from "next/navigation";
import { Flag } from "lucide-react";
import Link from "next/link";
import { Avatar } from "@/components/ui/Avatar";
import { Notice } from "@/components/ui/Notice";
import { Screen, ScreenBody, ScreenFooter } from "@/components/ui/Screen";
import { TopBar } from "@/components/ui/TopBar";
import { MessageBubble } from "@/components/chat/MessageBubble";
import { ProductRef } from "@/components/chat/ProductRef";
import { Composer } from "@/components/chat/Composer";
import { RealtimeThread } from "@/components/chat/RealtimeThread";
import { createClient } from "@/lib/supabase/server";
import { getThreadContext, getMessages } from "@/lib/data/messages";
import { getProduct } from "@/lib/data/products";
import { messagesHref } from "@/lib/space";

/** Fil de discussion — écran 30 de docs/ECRANS.md. */
export default async function ThreadPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ produit?: string; erreur?: string; info?: string }>;
}) {
  const { id } = await params;
  const { produit, erreur, info } = await searchParams;
  const supabase = await createClient();

  const context = await getThreadContext(supabase, id);
  if (!context) notFound();

  const [messages, citing] = await Promise.all([
    getMessages(supabase, id, context.myParticipantId),
    produit ? getProduct(supabase, produit) : Promise.resolve(null),
  ]);

  // Marquer comme lu ce que je viens de voir — seuls les messages reçus,
  // jamais les miens (policy "messages: marquer comme lu", 0002).
  /* Seule écriture du projet qui n'inspectait toujours RIEN — ni son
     erreur, ni son nombre de lignes. Son échec n'empêche personne de
     lire, mais il laisse le badge de non-lus faux indéfiniment, sans que
     rien ne le signale : exactement l'angle mort que le reste du code
     s'emploie à fermer partout ailleurs.

     L'erreur est journalisée plutôt que levée : rater le marquage « lu »
     ne doit pas empêcher d'AFFICHER le fil, ce serait échanger un badge
     faux contre un écran vide. */
  const { error: readError } = await supabase
    .from("messages")
    .update({ read_at: new Date().toISOString() })
    .eq("conversation_id", id)
    .is("read_at", null)
    .neq("sender_id", context.myParticipantId);
  if (readError) console.error("marquage lu impossible :", readError.message);

  /* D'où l'on vient, et donc où l'on retourne. Le contexte n'est PAS lu
     dans l'URL : il est déduit de la conversation elle-même. Un fil a
     exactement deux côtés, et `getThreadContext` sait déjà de quel côté
     se trouve la connexion active (`iAmMerchant`) — celui qui ouvre un
     fil en tant que commerçant est, par construction, dans son espace
     commerçant.

     Le lien de retour était figé sur `/messages`, et `/messages` choisit
     l'espace CLIENT dès que les deux profils existent : un commerçant
     parti de `/messages?vue=commercant` atterrissait donc dans sa boîte
     d'acheteur en appuyant sur « retour », avec la barre d'onglets du
     client. Un paramètre porté d'écran en écran aurait rattrapé ce
     chemin-là seulement ; le déduire du fil rattrape TOUS les chemins —
     un lien partagé, un favori, un retour après plusieurs écrans. */
  const space = context.iAmMerchant ? "merchant" : "client";

  const blockedByPeer = context.blockedBy !== null && context.blockedBy !== context.myParticipantId;
  /* Fil gelé : la boutique en face a un compte suspendu ou supprimé
     (0017). Le fil reste entièrement lisible — c'est la décision du
     2026-09-15, lecture seule et non suppression — mais plus personne n'y
     écrit, le commerçant suspendu compris.

     Sans cet état, le champ de saisie restait allumé et la base refusait
     l'envoi : le client recevait « new row violates row-level security
     policy », c'est-à-dire une phrase qui ne veut rien dire pour lui,
     après avoir tapé son message. Dire NON AVANT la frappe coûte une
     ligne et évite le message perdu. */
  const frozen = !context.isOpen;
  // Le premier message d'un fil DOIT citer un produit (trigger
  // `check_message_product`, 0002) : sans citation en attente sur un fil
  // encore vide, écrire échouerait — autant le dire avant plutôt qu'après.
  const mustCiteFirst = messages.length === 0 && !citing && !frozen;

  return (
    <Screen>
      <RealtimeThread conversationId={id} myParticipantId={context.myParticipantId} />
      <TopBar
        backHref={messagesHref(space)}
        title={
          <div className="flex items-center gap-3">
            <Avatar name={context.peerName} kind={context.peerKind} size={38} />
            <span className="flex flex-col">
              <span className="text-base font-semibold">{context.peerName}</span>
            </span>
          </div>
        }
        right={
          <Link href={`/messages/${id}/actions`} aria-label="Actions">
            <Flag size={19} strokeWidth={1.8} className="text-ink-soft" aria-hidden />
          </Link>
        }
      />

      {/* `justify-end` colle la conversation au bas de l'écran quand elle
          est courte : sinon les premiers messages flottent en haut, loin
          du champ de saisie, et l'écran paraît vide. */}
      <ScreenBody className="justify-end">
        {/* Résultat de la feuille d'actions (bloquer, signaler) : ces
            actions redirigent ici en portant leur message dans l'URL,
            faute de pouvoir l'afficher sur une feuille qui se ferme. */}
        {erreur ? <Notice>{erreur}</Notice> : null}
        {info ? <Notice tone="success">{info}</Notice> : null}

        <div className="flex flex-col gap-2.5 p-4">
          {messages.map((message) => (
            <div key={message.id} className="contents">
              {message.product ? <ProductRef product={message.product} /> : null}
              <MessageBubble message={message} />
            </div>
          ))}
        </div>
      </ScreenBody>

      <ScreenFooter className="flex flex-col gap-2">
        {frozen ? null : citing ? (
          <div className="flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-xs">
            <span className="flex-1 truncate">
              Concerne : <b>{citing.title}</b>
            </span>
            <Link href={`/messages/${id}`} className="shrink-0 font-medium text-ink-soft">
              Retirer
            </Link>
          </div>
        ) : mustCiteFirst ? (
          /* Le fil existe, il est vide, et rien n'y est cité : c'est
             exactement l'état où l'on revient quand on a touché
             « Contacter le vendeur » puis quitté avant d'écrire. Le
             produit voyageait dans `?produit=`, donc il disparaissait avec
             l'URL, et l'écran ne montrait plus qu'un champ de saisie
             éteint — sans dire ni pourquoi, ni comment le rallumer.

             La règle vient de la base (`check_message_product`, 0002 : le
             premier message d'un fil cite obligatoirement un produit) et
             elle ne bouge pas. Ce qui manquait, c'est de la DIRE, et
             d'ouvrir la porte qui existe déjà — l'écran 31, « citer un
             produit », qui liste justement le catalogue de cette
             boutique. */
          <Link
            href={`/messages/${id}/citer`}
            className="flex items-center gap-2 rounded-lg border border-accent bg-accent-soft px-3 py-2 text-xs text-accent-hover"
          >
            <span className="flex-1">
              Commencez par indiquer <b>de quel produit</b> vous parlez.
            </span>
            <span className="shrink-0 font-semibold">Choisir</span>
          </Link>
        ) : null}

        {frozen ? (
          /* Le texte ne dit pas « suspendue » : la sanction d'un
             commerçant ne se publie pas à ses clients (même raison que
             `merchant_is_public`, 0013, qui confond volontairement
             refusée, en attente et suspendue). Il dit ce qui est vrai et
             utile — la boutique ne peut plus répondre, et ce qui a été
             échangé reste là. */
          <p className="py-2 text-center text-sm text-ink-soft">
            {context.iAmMerchant
              ? "Votre compte ne permet plus d'écrire. Vos conversations restent consultables."
              : "Cette boutique n'est plus joignable sur Makiti. Vous pouvez relire vos échanges, mais plus lui écrire."}
          </p>
        ) : blockedByPeer ? (
          <p className="py-2 text-center text-sm text-ink-soft">Vous ne pouvez plus écrire dans ce fil.</p>
        ) : (
          <Composer conversationId={id} citingProductId={citing?.id} disabled={mustCiteFirst} />
        )}
      </ScreenFooter>
    </Screen>
  );
}
