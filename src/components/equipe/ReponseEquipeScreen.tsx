import { notFound } from "next/navigation";
import { RepondreEquipe } from "@/components/equipe/RepondreEquipe";
import { gardeEquipe } from "@/components/equipe/garde";
import { Screen, ScreenBody, ScreenFooter } from "@/components/ui/Screen";
import { TopBar } from "@/components/ui/TopBar";
import { cn } from "@/lib/cn";
import { CHEMINS_EQUIPE, lireEchangeEquipe, type MessageEchange } from "@/lib/data/equipe";
import type { Espace } from "@/lib/espace";
import { formatMessageTime } from "@/lib/format";
import { estUuid } from "@/lib/saisie";

/**
 * Une réponse de l'équipe (décision du 2026-11-05) : la question, la
 * réponse, ce que j'ai écrit depuis, et un champ pour répondre dans le
 * même fil. Après l'envoi, on revient ici et le message s'ajoute dessous.
 */
export async function ReponseEquipeScreen({ espace, params }: { espace: Espace; params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!estUuid(id)) notFound();
  const { supabase, user } = await gardeEquipe(espace);
  const echange = await lireEchangeEquipe(supabase, user.id, espace, id);
  if (!echange) notFound();
  await supabase.rpc("marquer_fil_equipe_lu", { p_espace: espace });
  return <ReponseEquipeVue espace={espace} reponseId={id} {...echange} />;
}

export function ReponseEquipeVue({
  espace,
  reponseId,
  question,
  reponse,
  suite,
}: {
  espace: Espace;
  reponseId: string;
  question: MessageEchange[];
  reponse: MessageEchange;
  suite: MessageEchange[];
}) {
  return (
    <Screen largeur="rangees">
      <TopBar title="Réponse de l'équipe" backHref={CHEMINS_EQUIPE[espace]} />
      <ScreenBody className="justify-end">
        <div className="flex flex-col gap-2.5 p-4">
          {question.length ? <Etiquette>Votre message</Etiquette> : null}
          {question.map((m) => (
            <Bulle key={m.id} message={m} />
          ))}
          <Etiquette>Réponse de l&apos;équipe Filloo</Etiquette>
          <Bulle message={reponse} />
          {suite.length ? <Etiquette>Vous avez répondu</Etiquette> : null}
          {suite.map((m) => (
            <Bulle key={m.id} message={m} />
          ))}
        </div>
      </ScreenBody>
      <ScreenFooter>
        <RepondreEquipe espace={espace} reponseA={reponseId} />
      </ScreenFooter>
    </Screen>
  );
}

function Etiquette({ children }: { children: React.ReactNode }) {
  return <span className="pt-1 text-center text-2xs font-semibold tracking-wide text-ink-soft uppercase">{children}</span>;
}

function Bulle({ message: m }: { message: MessageEchange }) {
  return (
    <div
      className={cn(
        "flex max-w-[80%] flex-col gap-0.5 px-3 pt-2.5 pb-2",
        m.deLEquipe
          ? "self-start rounded-lg rounded-bl-xs border border-line bg-surface"
          : "self-end rounded-lg rounded-br-xs bg-accent text-on-accent",
      )}
    >
      <p className="text-base leading-normal whitespace-pre-wrap">{m.texte}</p>
      <time className={cn("self-end text-2xs", m.deLEquipe ? "text-ink-soft" : "text-on-accent/75")}>
        {m.deLEquipe ? "Équipe Filloo · " : ""}
        {formatMessageTime(m.quand)}
      </time>
    </div>
  );
}
