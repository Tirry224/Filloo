import Link from "next/link";
import { redirect } from "next/navigation";
import { ProduitsLesPlusVus, ResumeStatistiques, TendancesFilloo } from "@/components/abonnement/StatistiquesBoutique";
import { ScreenBody, Section, TabScreen } from "@/components/ui/Screen";
import { TopBar } from "@/components/ui/TopBar";
import { cn } from "@/lib/cn";
import { maFormule, produitsLesPlusVus, statistiquesBoutique, tendancesFilloo } from "@/lib/data/abonnements";
import { createClient } from "@/lib/supabase/server";

const PERIODES = [7, 30, 90] as const;

/**
 * La page « Statistiques », réservée à Business (0059, document de
 * monétisation 2.1) : la boutique sur 7, 30 ou 90 jours, et les tendances
 * de tout Filloo. Un autre compte est renvoyé vers son abonnement.
 */
export default async function StatistiquesPage({ searchParams }: { searchParams: Promise<{ jours?: string }> }) {
  const { jours: brut } = await searchParams;
  const jours = PERIODES.find((p) => String(p) === brut) ?? 30;
  const supabase = await createClient();
  const formule = await maFormule(supabase);
  if (formule.formule !== "business") redirect("/vendeur/abonnement");

  const [stats, plusVus, tendances] = await Promise.all([
    statistiquesBoutique(supabase, jours),
    produitsLesPlusVus(supabase, jours),
    tendancesFilloo(supabase, jours),
  ]);

  return (
    <TabScreen largeur="rangees">
      <TopBar title="Statistiques" />
      <ScreenBody>
        <Section className="gap-5">
          <nav aria-label="Période" className="grid grid-cols-3 gap-1 rounded-lg bg-paper p-1">
            {PERIODES.map((p) => (
              <Link
                key={p}
                href={`/vendeur/statistiques?jours=${p}`}
                aria-current={p === jours ? "page" : undefined}
                className={cn(
                  "flex h-tap items-center justify-center rounded-md text-sm font-semibold",
                  p === jours ? "bg-surface text-ink" : "text-ink-soft",
                )}
              >
                {p} jours
              </Link>
            ))}
          </nav>
          <ResumeStatistiques jours={stats} titre="Votre boutique" />
          <ProduitsLesPlusVus produits={plusVus} />
          <TendancesFilloo tendances={tendances} />
        </Section>
      </ScreenBody>
    </TabScreen>
  );
}
