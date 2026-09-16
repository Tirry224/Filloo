import { notFound, redirect } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Field";
import { Sheet } from "@/components/ui/Sheet";
import { createClient } from "@/lib/supabase/server";
import { getThreadContext } from "@/lib/data/messages";
import { reportConversationAction } from "@/lib/actions/messages";
import { conversationReportReasons } from "@/lib/mock";
import { messagesBase, type Espace } from "@/lib/espace";

/**
 * Écran 32b — signaler une conversation.
 *
 * La maquette (`design/SignalerConversation.dc.html`) prévoyait cet écran
 * depuis le début ; l'action serveur existait déjà, mais la feuille
 * d'actions (écran 32) l'appelait avec un motif figé. Le motif se choisit
 * maintenant ici.
 *
 * Composant serveur et `<form>` classique, sans `useActionState` :
 * `reportConversationAction` redirige vers le fil en portant son message
 * dans l'URL, donc l'écran fonctionne sans JavaScript (PERFORMANCE.md).
 * Les motifs sont de vraies cases radio natives, pour la même raison que
 * dans `ReportForm` — la sélection doit voyager dans le formulaire, pas
 * dépendre d'un état client.
 */
export async function ReportThreadScreen({
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
  if (espaceReel !== espace) redirect(`${messagesBase(espaceReel)}/${id}/signaler`);

  return (
    <Sheet
      title="Signaler cette conversation"
      description="Votre signalement est envoyé à l'équipe Makiti. La personne n'est pas prévenue."
      closeHref={`${base}/${id}`}
    >
      <form action={reportConversationAction} className="flex flex-col gap-3.5">
        <input type="hidden" name="conversationId" value={id} />
        <div>
          {conversationReportReasons.map((reason, index) => (
            <label
              key={reason}
              className="flex min-h-tap cursor-pointer items-center gap-3 border-b border-line py-2.5 last:border-b-0"
            >
              <input
                type="radio"
                name="reason"
                value={reason}
                defaultChecked={index === 0}
                required
                className="size-5 accent-accent"
              />
              <span className="text-base">{reason}</span>
            </label>
          ))}
        </div>
        <Textarea
          name="details"
          rows={3}
          placeholder="Précisez si besoin (facultatif)…"
          aria-label="Précisions"
        />
        <Button type="submit">Envoyer le signalement</Button>
      </form>
    </Sheet>
  );
}
