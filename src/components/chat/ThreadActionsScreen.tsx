import { notFound, redirect } from "next/navigation";
import { Ban, Flag, User } from "lucide-react";
import { ActionRow } from "@/components/ui/ActionRow";
import { Sheet } from "@/components/ui/Sheet";
import { createClient } from "@/lib/supabase/server";
import { getThreadContext } from "@/lib/data/messages";
import { blockPeerAction } from "@/lib/actions/messages";
import { messagesBase, type Espace } from "@/lib/espace";

/**
 * Écran 32 — actions sur une conversation.
 *
 * « Voir sa fiche » n'a de sens QUE côté client (vers la boutique
 * publique, `/boutique/[id]`) : il n'existe pas de fiche publique pour un
 * client, la messagerie interne étant le seul contact prévu avec lui.
 */
export async function ThreadActionsScreen({
  espace,
  params,
}: {
  /** Imposé par la route qui monte ce composant, jamais lu dans l'URL :
   *  c'est ce qui garde la feuille dans l'espace d'où elle a été ouverte. */
  espace: Espace;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const base = messagesBase(espace);
  const supabase = await createClient();

  const context = await getThreadContext(supabase, id);
  if (!context) notFound();

  /* La même garde que `ThreadScreen`, pour la même raison : un fil a deux
     côtés, `getThreadContext` sait lequel est le nôtre, et le chemin
     emprunté doit correspondre à ce fait. Elle manquait ici — le fil
     était gardé, ses trois feuilles ne l'étaient pas. Un commerçant
     ouvrant `/messages/<id>/actions` obtenait donc cette feuille habillée
     en client, dont le bouton de fermeture ne le ramenait dans son espace
     qu'au coup d'après, par le rattrapage de `ThreadScreen`.

     C'est exactement le motif que cette réorganisation corrigeait
     ailleurs : la garde écrite sur un écran et oubliée sur ses voisins. */
  const espaceReel: Espace = context.iAmMerchant ? "merchant" : "client";
  if (espaceReel !== espace) redirect(`${messagesBase(espaceReel)}/${id}/actions`);

  const blockedByMe = context.blockedBy === context.myParticipantId;

  return (
    <Sheet title={context.peerName} closeHref={`${base}/${id}`}>
      <div>
        {!context.iAmMerchant ? (
          <ActionRow
            icon={User}
            label="Voir la boutique"
            description="Ville, catégories, tous ses produits."
            href={`/boutique/${context.merchantPublicId}`}
          />
        ) : null}

        {context.blockedBy === null ? (
          <ActionRow
            icon={Flag}
            label="Signaler cette conversation"
            description="Insultes, arnaque, spam. Notre équipe la lira."
            tone="danger"
            href={`${base}/${id}/signaler`}
          />
        ) : null}

        {blockedByMe ? (
          <p className="py-3.5 text-sm text-ink-soft">Vous avez bloqué cette personne.</p>
        ) : (
          <ActionRow
            icon={Ban}
            label="Bloquer cette personne"
            // « Le fil reste consultable » se lisait comme un geste doux
            // et réversible. Il ne l'est pas : la policy « conversations:
            // je bloque mon interlocuteur » n'autorise qu'à POSER
            // `blocked_by`, jamais à l'effacer, et aucun écran ne propose
            // de débloquer — c'est une décision assumée de v1
            // (docs/REPRISE.md section 4). Sur un marché où l'on se
            // recroise, un blocage par erreur ferme définitivement le
            // seul canal de contact avec un vendeur. La décision reste,
            // l'écran cesse de la cacher.
            description="Elle ne pourra plus vous écrire. Le fil reste consultable. C'est définitif : on ne peut pas débloquer."
            tone="danger"
            action={blockPeerAction}
            hiddenFields={{ conversationId: id }}
          />
        )}
      </div>
    </Sheet>
  );
}
