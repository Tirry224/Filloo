import { notFound } from "next/navigation";
import { Megaphone } from "lucide-react";
import { gardeEquipe } from "@/components/equipe/garde";
import { Screen, ScreenBody, Section } from "@/components/ui/Screen";
import { TopBar } from "@/components/ui/TopBar";
import { CHEMINS_EQUIPE, lireAnnonceEquipe } from "@/lib/data/equipe";
import type { Espace } from "@/lib/espace";
import { formatMessageTime } from "@/lib/format";
import { estUuid } from "@/lib/saisie";

/** Une annonce, en lecture seule : on n'y répond pas (décision du 2026-11-05). */
export async function AnnonceEquipeScreen({ espace, params }: { espace: Espace; params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!estUuid(id)) notFound();
  const { supabase } = await gardeEquipe(espace);
  const annonce = await lireAnnonceEquipe(supabase, id, espace);
  if (!annonce) notFound();
  return <AnnonceEquipeVue espace={espace} {...annonce} />;
}

export function AnnonceEquipeVue({
  espace,
  titre,
  texte,
  quand,
  modifieeAt = null,
}: {
  espace: Espace;
  titre: string;
  texte: string;
  quand: string;
  modifieeAt?: string | null;
}) {
  return (
    <Screen largeur="rangees">
      <TopBar title="Annonce" backHref={CHEMINS_EQUIPE[espace]} />
      <ScreenBody>
        <Section className="gap-4">
          <article className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-4">
            <span className="flex items-center gap-2 text-xs font-semibold text-accent-hover">
              <Megaphone size={15} strokeWidth={2} aria-hidden />
              Équipe Filloo · {formatMessageTime(quand)}
              {modifieeAt ? ` · modifiée ${formatMessageTime(modifieeAt)}` : ""}
            </span>
            <h2 className="text-xl font-bold">{titre}</h2>
            <p className="text-base leading-relaxed whitespace-pre-wrap">{texte}</p>
          </article>
          <p className="text-center text-xs text-ink-soft">
            Les annonces ne reçoivent pas de réponse. Pour écrire à l&apos;équipe, touchez « Écrire » sur la page Équipe Filloo.
          </p>
        </Section>
      </ScreenBody>
    </Screen>
  );
}
