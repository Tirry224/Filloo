import { TableauDeBord } from "@/components/suivi/TableauDeBord";
import { Screen } from "@/components/ui/Screen";
import { TopBar } from "@/components/ui/TopBar";
import { lirePeriode } from "@/lib/data/suivi";

/**
 * Les statistiques de Filloo pour toute l'équipe : le même tableau que
 * `/suivi`. La garde est `admin/layout.tsx` (membre de l'équipe, sinon la
 * page n'existe pas) : elle a répondu avant que le tableau lise quoi que
 * ce soit en `service_role`.
 */
export default async function StatistiquesPage({ searchParams }: { searchParams: Promise<{ periode?: string }> }) {
  const periode = lirePeriode((await searchParams).periode);
  return (
    <Screen largeur="rangees">
      <TopBar title="Statistiques" />
      <TableauDeBord base="/admin/statistiques" periode={periode} />
    </Screen>
  );
}
