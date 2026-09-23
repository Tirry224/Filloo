import { notFound, redirect } from "next/navigation";
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
import { messagesBase, type Espace } from "@/lib/espace";

export async function ThreadScreen({
  espace,
  params,
  searchParams,
}: {
  /** Imposé par la route qui monte ce composant, jamais lu dans l'URL. */
  espace: Espace;
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
  const { error: readError } = await supabase
    .from("messages")
    .update({ read_at: new Date().toISOString() })
    .eq("conversation_id", id)
    .is("read_at", null)
    .neq("sender_id", context.myParticipantId);
  if (readError) console.error("marquage lu impossible :", readError.message);

  /* La garde de ce fil, dans les deux sens : le côté réel est un FAIT que
     `getThreadContext` connaît, il ne se lit pas dans l'URL. Un commerçant
     qui ouvre un favori vers `/messages/xxx` atterrit donc sur
     `/vendeur/messages/xxx`, avec sa barre d'onglets.

     Le RLS reste seul maître des DONNÉES ; cette garde protège le
     PARCOURS. */
  const espaceReel: Espace = context.iAmMerchant ? "merchant" : "client";
  if (espaceReel !== espace) redirect(`${messagesBase(espaceReel)}/${id}`);

  const base = messagesBase(espace);

  const blockedByPeer = context.blockedBy !== null && context.blockedBy !== context.myParticipantId;
  /* Fil gelé : un compte suspendu ou supprimé en face (0017). Lecture
     seule, jamais suppression. Sans cet état, le champ resterait allumé et
     le message tapé serait perdu contre un refus du RLS illisible — dire
     non avant la frappe coûte une ligne. */
  const frozen = !context.isOpen;
  // Le premier message d'un fil DOIT citer un produit (trigger
  // `check_message_product`, 0002) : sans citation en attente sur un fil
  // encore vide, écrire échouerait — autant le dire avant plutôt qu'après.
  const mustCiteFirst = messages.length === 0 && !citing && !frozen;

  return (
    <Screen largeur="rangees">
      <RealtimeThread conversationId={id} myParticipantId={context.myParticipantId} />
      <TopBar
        backHref={base}
        title={
          <div className="flex items-center gap-3">
            <Avatar name={context.peerName} kind={context.peerKind} size={38} />
            <span className="flex flex-col">
              <span className="text-base font-semibold">{context.peerName}</span>
            </span>
          </div>
        }
        right={
          <Link href={`${base}/${id}/actions`} aria-label="Actions">
            <Flag size={19} strokeWidth={1.8} className="text-ink-soft" aria-hidden />
          </Link>
        }
      />

      <ScreenBody className="justify-end">
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
            <Link href={`${base}/${id}`} className="shrink-0 font-medium text-ink-soft">
              Retirer
            </Link>
          </div>
        ) : mustCiteFirst ? (
          <Link
            href={`${base}/${id}/citer`}
            className="flex items-center gap-2 rounded-lg border border-accent bg-accent-soft px-3 py-2 text-xs text-accent-hover"
          >
            <span className="flex-1">
              Commencez par indiquer <b>de quel produit</b> vous parlez.
            </span>
            <span className="shrink-0 font-semibold">Choisir</span>
          </Link>
        ) : null}

        {frozen ? (
          /* Trois textes, parce que `0022` gèle le fil dans les deux sens
             et qu'il faut savoir DE QUI vient la sanction. La mienne se dit
             franchement ; celle d'en face jamais — la sanction d'un tiers
             ne se publie pas (même raison que `merchant_is_public`, 0013),
             on dit seulement que la personne n'est plus joignable. */
          <p className="py-2 text-center text-sm text-ink-soft">
            {context.iAmSuspended
              ? "Votre compte ne permet plus d'écrire. Vos conversations restent consultables."
              : context.iAmMerchant
                ? "Cette personne n'est plus joignable sur Filloo. Vous pouvez relire vos échanges, mais plus lui écrire."
                : "Cette boutique n'est plus joignable sur Filloo. Vous pouvez relire vos échanges, mais plus lui écrire."}
          </p>
        ) : blockedByPeer ? (
          <p className="py-2 text-center text-sm text-ink-soft">Vous ne pouvez plus écrire dans ce fil.</p>
        ) : (
          <Composer conversationId={id} basePath={base} citingProductId={citing?.id} disabled={mustCiteFirst} />
        )}
      </ScreenFooter>
    </Screen>
  );
}
