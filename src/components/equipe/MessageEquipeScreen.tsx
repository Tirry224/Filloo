import { notFound, redirect } from "next/navigation";
import { Clock } from "lucide-react";
import { gardeEquipe } from "@/components/equipe/garde";
import { Screen, ScreenBody, Section } from "@/components/ui/Screen";
import { TopBar } from "@/components/ui/TopBar";
import { CHEMINS_EQUIPE, lireMonMessageEquipe, type MessageEchange } from "@/lib/data/equipe";
import type { Espace } from "@/lib/espace";
import { formatMessageTime } from "@/lib/format";
import { estUuid } from "@/lib/saisie";

/**
 * Un message que j'ai envoyé et qui attend sa réponse. Dès que l'équipe a
 * répondu, l'adresse mène à la page de la réponse, qui le contient.
 */
export async function MessageEquipeScreen({ espace, params }: { espace: Espace; params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!estUuid(id)) notFound();
  const { supabase, user } = await gardeEquipe(espace);
  const lu = await lireMonMessageEquipe(supabase, user.id, espace, id);
  if (!lu) notFound();
  if (lu.reponseId) redirect(`${CHEMINS_EQUIPE[espace]}/reponse/${lu.reponseId}`);
  return <MessageEquipeVue espace={espace} message={lu.message} />;
}

export function MessageEquipeVue({ espace, message }: { espace: Espace; message: MessageEchange }) {
  return (
    <Screen largeur="rangees">
      <TopBar title="Votre message" backHref={CHEMINS_EQUIPE[espace]} />
      <ScreenBody>
        <Section className="gap-3">
          <div className="flex max-w-[85%] flex-col gap-0.5 self-end rounded-lg rounded-br-xs bg-accent px-3 pt-2.5 pb-2 text-on-accent">
            <p className="text-base leading-normal whitespace-pre-wrap">{message.texte}</p>
            <time className="self-end text-2xs text-on-accent/75">Envoyé · {formatMessageTime(message.quand)}</time>
          </div>
          <p className="flex items-center justify-center gap-2 pt-2 text-sm text-warn-ink">
            <Clock size={16} strokeWidth={2} aria-hidden />
            En attente de réponse de l&apos;équipe
          </p>
          <p className="text-center text-xs text-ink-soft">
            Vous serez prévenu dès que l&apos;équipe répondra ; sa réponse apparaîtra dans Équipe Filloo.
          </p>
        </Section>
      </ScreenBody>
    </Screen>
  );
}
