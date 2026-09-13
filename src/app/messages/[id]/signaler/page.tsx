import { notFound } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Field";
import { Sheet } from "@/components/ui/Sheet";
import { createClient } from "@/lib/supabase/server";
import { getThreadContext } from "@/lib/data/messages";
import { reportConversationAction } from "@/lib/actions/messages";
import { conversationReportReasons } from "@/lib/mock";

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
export default async function ReportThreadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const context = await getThreadContext(supabase, id);
  if (!context) notFound();

  return (
    <Sheet
      title="Signaler cette conversation"
      description="Votre signalement est envoyé à l'équipe Makiti. La personne n'est pas prévenue."
      closeHref={`/messages/${id}`}
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
