import { FormulaireEquipe } from "@/components/equipe/FormulaireEquipe";
import { gardeEquipe } from "@/components/equipe/garde";
import { Screen, ScreenBody, Section } from "@/components/ui/Screen";
import { TopBar } from "@/components/ui/TopBar";
import { CHEMINS_EQUIPE } from "@/lib/data/equipe";
import type { Espace } from "@/lib/espace";

/** Écrire à l'équipe, depuis le bouton « Écrire » d'Équipe Filloo. */
export async function EcrireEquipeScreen({ espace }: { espace: Espace }) {
  await gardeEquipe(espace);
  return (
    <Screen>
      <TopBar title="Écrire à l'équipe" backHref={CHEMINS_EQUIPE[espace]} />
      <ScreenBody>
        <Section className="gap-4">
          <FormulaireEquipe espace={espace} />
        </Section>
      </ScreenBody>
    </Screen>
  );
}
