import { MessagesSquare } from "lucide-react";
import { EnvoiEnCoursProvider, MessageEnCours } from "@/components/chat/EnvoiEnCours";
import { ScrollToLatest } from "@/components/chat/ScrollToLatest";
import { RepondreEquipe } from "@/components/equipe/RepondreEquipe";
import { gardeEquipe } from "@/components/equipe/garde";
import { EmptyState } from "@/components/ui/EmptyState";
import { Screen, ScreenBody, ScreenFooter } from "@/components/ui/Screen";
import { TopBar } from "@/components/ui/TopBar";
import { cn } from "@/lib/cn";
import { CHEMINS_EQUIPE, lireDiscussionEquipe, type MessageEchange } from "@/lib/data/equipe";
import type { Espace } from "@/lib/espace";
import { formatMessageTime } from "@/lib/format";
import { TexteAvecLiens } from "@/components/ui/TexteAvecLiens";

/**
 * LA discussion avec l'équipe pour cet espace (décision du 2026-11-05) :
 * tous les messages, dans l'ordre, qu'ils viennent du bouton « Écrire » ou
 * d'une réponse, et le champ pour écrire en bas. Après l'envoi on y reste
 * (la page se remplace elle-même), le message s'ajoute en bas.
 */
export async function DiscussionEquipeScreen({
  espace,
  searchParams,
}: {
  espace: Espace;
  searchParams: Promise<{ ecrire?: string }>;
}) {
  const { ecrire } = await searchParams;
  const { supabase, user } = await gardeEquipe(espace);
  const messages = await lireDiscussionEquipe(supabase, user.id, espace);
  await supabase.rpc("marquer_fil_equipe_lu", { p_espace: espace });
  return <DiscussionEquipeVue espace={espace} messages={messages} ecrire={Boolean(ecrire)} />;
}

export function DiscussionEquipeVue({
  espace,
  messages,
  ecrire,
}: {
  espace: Espace;
  messages: MessageEchange[];
  ecrire: boolean;
}) {
  const dernier = messages[messages.length - 1];
  return (
    <Screen largeur="rangees">
      <EnvoiEnCoursProvider>
        <ScrollToLatest lastMessageId={dernier?.id ?? null} lastIsMine={dernier ? !dernier.deLEquipe : false} />
        <TopBar title="Discussion avec l'équipe" backHref={CHEMINS_EQUIPE[espace]} />
        <ScreenBody className={messages.length ? "justify-end" : undefined}>
          {messages.length === 0 ? (
            <>
              <MessageEnCoursSeul />
              <EmptyState
                icon={MessagesSquare}
                title="Écrivez à l'équipe Filloo"
                description="Une question, une idée, un problème ? Écrivez ci-dessous : une personne de l'équipe vous répondra ici."
              />
            </>
          ) : (
            <div className="flex flex-col gap-2.5 p-4">
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={cn(
                    "flex max-w-[80%] flex-col gap-0.5 px-3 pt-2.5 pb-2",
                    m.deLEquipe
                      ? "self-start rounded-lg rounded-bl-xs border border-line bg-surface"
                      : "self-end rounded-lg rounded-br-xs bg-accent text-on-accent",
                  )}
                >
                  <p className="text-base leading-normal whitespace-pre-wrap"><TexteAvecLiens texte={m.texte} /></p>
                  <time className={cn("self-end text-2xs", m.deLEquipe ? "text-ink-soft" : "text-on-accent/75")}>
                    {m.deLEquipe ? "Équipe Filloo · " : ""}
                    {formatMessageTime(m.quand)}
                  </time>
                </div>
              ))}
              <MessageEnCours />
            </div>
          )}
        </ScreenBody>
        <ScreenFooter>
          <RepondreEquipe espace={espace} focus={ecrire || messages.length === 0} />
        </ScreenFooter>
      </EnvoiEnCoursProvider>
    </Screen>
  );
}

/** Premier message d'une discussion vide : la bulle provisoire s'affiche au-dessus de l'invitation. */
function MessageEnCoursSeul() {
  return (
    <div className="flex flex-col px-4 pt-4">
      <MessageEnCours />
    </div>
  );
}
