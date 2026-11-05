import { AdminTopBar } from "@/components/admin/AdminTopBar";
import { TableauDeBord } from "@/components/statistiques/TableauDeBord";
import { TabScreen } from "@/components/ui/Screen";
import { lirePeriode } from "@/lib/data/statistiques";

/**
 * Les statistiques de Filloo pour toute l'équipe (elles remplacent
 * `/suivi`, supprimée le 2026-11-05). La garde est `admin/layout.tsx`
 * (membre de l'équipe, sinon la page n'existe pas) : elle a répondu avant
 * que le tableau lise quoi que ce soit en `service_role`.
 */
export default async function StatistiquesPage({ searchParams }: { searchParams: Promise<{ periode?: string }> }) {
  const periode = lirePeriode((await searchParams).periode);
  return (
    <TabScreen largeur="rangees">
      <AdminTopBar />
      <TableauDeBord base="/admin/statistiques" periode={periode} />
    </TabScreen>
  );
}
