import Link from "next/link";
import { Megaphone } from "lucide-react";
import { FormulaireEquipe } from "@/components/equipe/FormulaireEquipe";
import { gardeEquipe } from "@/components/equipe/garde";
import { Screen, ScreenBody, Section } from "@/components/ui/Screen";
import { TopBar } from "@/components/ui/TopBar";
import { CHEMINS_EQUIPE, PUBLICS_DE } from "@/lib/data/equipe";
import type { Espace } from "@/lib/espace";
import { estUuid } from "@/lib/saisie";

/**
 * Écrire à l'équipe, depuis le bouton « Écrire » ou « Répondre » sous une
 * annonce (`?repondre=`). L'annonce n'est citée que si la personne l'a
 * reçue : le RLS ne rend que les siennes, et la base revérifie à l'envoi.
 */
export async function EcrireEquipeScreen({
  espace,
  searchParams,
}: {
  espace: Espace;
  searchParams: Promise<{ repondre?: string }>;
}) {
  const { repondre } = await searchParams;
  const { supabase } = await gardeEquipe(espace);
  const chemin = CHEMINS_EQUIPE[espace];

  const { data: annonce } = estUuid(repondre)
    ? await supabase
        .from("annonces")
        .select("id, titre")
        .eq("id", repondre)
        .in("public", [...PUBLICS_DE[espace]])
        .maybeSingle()
    : { data: null };

  return (
    <Screen>
      <TopBar title={annonce ? "Répondre à l'équipe" : "Écrire à l'équipe"} backHref={chemin} />
      <ScreenBody>
        <Section className="gap-4">
          {annonce ? (
            <div className="flex items-center gap-2.5 rounded-lg border border-line bg-surface px-3.5 py-2.5 text-sm">
              <Megaphone size={16} strokeWidth={2} className="shrink-0 text-accent" aria-hidden />
              <span className="min-w-0 flex-1 truncate">
                En réponse à <strong>{annonce.titre}</strong>
              </span>
              <Link href={`${chemin}/ecrire`} className="shrink-0 text-xs font-medium text-ink-soft underline underline-offset-2">
                Retirer
              </Link>
            </div>
          ) : null}
          <FormulaireEquipe espace={espace} annonceId={annonce?.id} />
        </Section>
      </ScreenBody>
    </Screen>
  );
}
