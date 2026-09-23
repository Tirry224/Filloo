import { notFound, redirect } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Field";
import { Sheet } from "@/components/ui/Sheet";
import { createClient } from "@/lib/supabase/server";
import { getThreadContext } from "@/lib/data/messages";
import { reportConversationAction } from "@/lib/actions/messages";
import { conversationReportReasons } from "@/lib/mock";
import { messagesBase, type Espace } from "@/lib/espace";

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

  const espaceReel: Espace = context.iAmMerchant ? "merchant" : "client";
  if (espaceReel !== espace) redirect(`${messagesBase(espaceReel)}/${id}/signaler`);

  return (
    <Sheet
      title="Signaler cette conversation"
      description="Votre signalement est envoyé à l'équipe Filloo. La personne n'est pas prévenue."
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
