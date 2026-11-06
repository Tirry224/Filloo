import { History } from "lucide-react";
import { jourEtHeure } from "@/components/admin/EtatAnnonce";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Screen, ScreenBody, Section } from "@/components/ui/Screen";
import { TopBar } from "@/components/ui/TopBar";
import { ACTIONS_JOURNAL, DECISIONS, type EntreeJournal } from "@/lib/data/moderation";

/**
 * L'historique de l'équipe (0046) : qui a fait quoi, quand, et pourquoi.
 * Écrit seulement par la base au moment du geste ; personne, pas même
 * l'équipe, ne peut le modifier ni l'effacer.
 */
export function HistoriqueVue({ entrees }: { entrees: EntreeJournal[] }) {
  return (
    <Screen largeur="rangees">
      <TopBar backHref="/admin/moderation" title="Historique de l'équipe" />
      <ScreenBody>
        <Section className="gap-2.5">
          {entrees.length === 0 ? (
            <EmptyState icon={History} title="Aucune action" description="Chaque suspension, réactivation, masquage ou signalement traité s'inscrira ici." />
          ) : (
            entrees.map((e) => (
              <Card key={e.id} className="flex flex-col gap-1 p-3.5">
                <span className="text-sm">
                  <span className="font-semibold">{e.auteur_nom}</span>{" "}
                  {ACTIONS_JOURNAL[e.action as keyof typeof ACTIONS_JOURNAL] ?? e.action}
                </span>
                {e.motif ? (
                  <p className="text-sm text-ink-soft">
                    {DECISIONS[e.motif as keyof typeof DECISIONS] ?? e.motif}
                  </p>
                ) : null}
                <time className="text-2xs text-ink-soft">{jourEtHeure(e.created_at)}</time>
              </Card>
            ))
          )}
        </Section>
      </ScreenBody>
    </Screen>
  );
}
