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
 * UN COMPOSANT, DEUX ROUTES, ET CE N'EST PAS UNE CONTRADICTION
 * `/messages/[id]` et `/vendeur/messages/[id]` montent toutes deux ce
 * fichier. C'est exactement ce que demande la règle « séparer les routes,
 * garder les composants réellement réutilisables » : un fil a deux côtés,
 * il se dessine pareil des deux, et le dupliquer créerait deux versions
 * qui divergeraient au premier correctif.
 *
 * Ce qui est séparé, c'est ce qui DOIT l'être : la route, le layout, la
 * barre d'onglets, et la garde ci-dessous. L'espace n'est plus deviné —
 * il est imposé par le chemin emprunté, et confronté à la réalité de la
 * conversation.
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

  /* HISTORIQUE, parce qu'il explique pourquoi la route est découpée
     ainsi aujourd'hui : le lien de retour de cet écran était figé sur
     `/messages`, qui choisissait l'espace CLIENT dès que les deux
     profils existaient. Un commerçant appuyait sur « retour » et
     atterrissait dans sa boîte d'acheteur, avec la barre d'onglets du
     client.

     On a d'abord corrigé en déduisant l'espace du fil et en portant un
     paramètre `?vue=` dans le lien. Ça marchait, et ça restait fragile :
     un paramètre se perd, un chemin se perd moins. La déduction est
     conservée — c'est elle qui alimente la garde ci-dessus — mais elle
     ne sert plus à fabriquer un lien : elle sert à VÉRIFIER qu'on est
     sur le bon chemin. */
  /* LA GARDE DE CE FIL, et elle vaut dans les deux sens.

     Un fil a exactement deux côtés, et `getThreadContext` sait de quel
     côté se trouve la connexion active. Le côté réel est donc un FAIT,
     pas une préférence : il ne se lit pas dans l'URL, il se déduit de la
     conversation.

     Si le chemin emprunté ne correspond pas à ce fait, on ne rend pas
     l'écran — on renvoie sur le même fil, dans le bon espace. Ce n'est
     pas un refus : c'est la même conversation, vue depuis l'espace où
     cette personne a effectivement le droit d'être. Un commerçant qui
     ouvre un favori vers `/messages/xxx` atterrit sur
     `/vendeur/messages/xxx`, avec sa barre d'onglets à lui.

     Le RLS reste seul maître des DONNÉES : `getThreadContext` renvoie
     déjà `null` — donc `notFound()` — pour un fil qui ne nous concerne
     pas. Cette garde-ci ne protège pas les messages, elle protège le
     PARCOURS : sans elle, les deux espaces se remélangeaient au premier
     lien. */
  const espaceReel: Espace = context.iAmMerchant ? "merchant" : "client";
  if (espaceReel !== espace) redirect(`${messagesBase(espaceReel)}/${id}`);

  const base = messagesBase(espace);

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
          /* TROIS textes, et pas deux, depuis que `0022` gèle le fil dans
             les deux sens : il faut d'abord savoir DE QUI vient la
             sanction.

             Ma propre suspension se dit franchement — c'est la mienne,
             `/compte/suspendu` me l'annonce déjà, et un email aussi
             depuis `0021`. Celle d'en face, jamais : la sanction d'un
             tiers ne se publie pas (même raison que `merchant_is_public`,
             0013, qui confond volontairement refusée, en attente et
             suspendue). On dit alors ce qui est vrai et utile — l'autre
             n'est plus joignable, et ce qui a été échangé reste là.

             Sans ce tri, le commerçant en règle dont le client vient
             d'être suspendu lisait « votre compte ne permet plus
             d'écrire » : une accusation fausse, sur un écran où il n'a
             personne à qui répondre. */
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
