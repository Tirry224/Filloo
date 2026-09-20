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

/**
 * Fil de discussion — écran 30 de docs/ECRANS.md.
 *
 * Un seul composant pour `/messages/[id]` et `/vendeur/messages/[id]` : un
 * fil se dessine pareil des deux côtés, le dupliquer créerait deux versions
 * qui divergeraient au premier correctif. Seuls la route, le layout, la
 * barre d'onglets et la garde ci-dessous sont séparés ; l'espace est imposé
 * par le chemin emprunté, puis confronté à la conversation.
 */
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
  /* L'erreur est journalisée plutôt que levée : rater le marquage « lu »
     ne doit pas empêcher d'AFFICHER le fil, ce serait échanger un badge de
     non-lus faux contre un écran vide. Mais elle est inspectée : sans ça,
     l'échec laisse le badge faux indéfiniment sans que rien ne le signale. */
  const { error: readError } = await supabase
    .from("messages")
    .update({ read_at: new Date().toISOString() })
    .eq("conversation_id", id)
    .is("read_at", null)
    .neq("sender_id", context.myParticipantId);
  if (readError) console.error("marquage lu impossible :", readError.message);

  /* LA GARDE DE CE FIL, dans les deux sens. Le côté réel est un FAIT que
     `getThreadContext` connaît : il ne se lit pas dans l'URL. Si le chemin
     emprunté ne lui correspond pas, on renvoie sur le même fil dans le bon
     espace — un commerçant qui ouvre un favori vers `/messages/xxx`
     atterrit sur `/vendeur/messages/xxx`, avec sa barre d'onglets.

     Le RLS reste seul maître des DONNÉES : `getThreadContext` renvoie déjà
     `null` — donc `notFound()` — pour un fil qui ne nous concerne pas.
     Cette garde protège le PARCOURS : sans elle, les deux espaces se
     remélangeaient au premier lien. */
  const espaceReel: Espace = context.iAmMerchant ? "merchant" : "client";
  if (espaceReel !== espace) redirect(`${messagesBase(espaceReel)}/${id}`);

  const base = messagesBase(espace);

  const blockedByPeer = context.blockedBy !== null && context.blockedBy !== context.myParticipantId;
  /* Fil gelé : un compte suspendu ou supprimé en face (0017). Décision :
     lecture seule, jamais suppression — le fil reste lisible, mais plus
     personne n'y écrit, le commerçant suspendu compris.

     Sans cet état le champ restait allumé et la base refusait l'envoi : le
     message tapé était perdu contre un « new row violates row-level
     security policy » illisible. Dire NON avant la frappe coûte une ligne. */
  const frozen = !context.isOpen;
  // Le premier message d'un fil DOIT citer un produit (trigger
  // `check_message_product`, 0002) : sans citation en attente sur un fil
  // encore vide, écrire échouerait — autant le dire avant plutôt qu'après.
  const mustCiteFirst = messages.length === 0 && !citing && !frozen;

  return (
    <Screen>
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
            <Link href={`${base}/${id}`} className="shrink-0 font-medium text-ink-soft">
              Retirer
            </Link>
          </div>
        ) : mustCiteFirst ? (
          /* Fil vide et rien de cité : l'état où l'on revient après avoir
             touché « Contacter le vendeur » puis quitté avant d'écrire, le
             produit voyageant dans `?produit=` disparaît avec l'URL. La
             règle vient de la base (`check_message_product`, 0002) et ne
             bouge pas ; ce qui manquait, c'est de la DIRE et d'ouvrir
             l'écran 31, « citer un produit ». */
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
          /* TROIS textes depuis que `0022` gèle le fil dans les deux sens :
             il faut savoir DE QUI vient la sanction. Ma propre suspension se
             dit franchement ; celle d'en face, jamais — la sanction d'un
             tiers ne se publie pas (même raison que `merchant_is_public`,
             0013), on dit seulement que la personne n'est plus joignable.
             Sans ce tri, le commerçant en règle dont le client vient d'être
             suspendu lisait une accusation fausse. */
          <p className="py-2 text-center text-sm text-ink-soft">
            {context.iAmSuspended
              ? "Votre compte ne permet plus d'écrire. Vos conversations restent consultables."
              : context.iAmMerchant
                ? "Cette personne n'est plus joignable sur Makiti. Vous pouvez relire vos échanges, mais plus lui écrire."
                : "Cette boutique n'est plus joignable sur Makiti. Vous pouvez relire vos échanges, mais plus lui écrire."}
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
