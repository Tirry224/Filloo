import { notFound, redirect } from "next/navigation";
import { Ban, Flag, User } from "lucide-react";
import { ActionRow } from "@/components/ui/ActionRow";
import { Sheet } from "@/components/ui/Sheet";
import { createClient } from "@/lib/supabase/server";
import { getThreadContext } from "@/lib/data/messages";
import { blockPeerAction } from "@/lib/actions/messages";
import { messagesBase, type Espace } from "@/lib/espace";

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
            // Le blocage est DÉFINITIF : la policy « conversations: je
            // bloque mon interlocuteur » n'autorise qu'à POSER
            // `blocked_by`, et aucun écran ne débloque (décision de v1,
            // docs/MEMOIRE.md, « Décisions prises »). L'écran doit le dire.
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
