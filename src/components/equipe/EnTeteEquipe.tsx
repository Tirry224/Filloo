import Link from "next/link";
import { SquarePen } from "lucide-react";
import { TopBar } from "@/components/ui/TopBar";
import { cn } from "@/lib/cn";
import { CHEMINS_EQUIPE, type EspaceEquipe } from "@/lib/data/equipe";

/**
 * L'en-tête d'« Équipe Filloo » : retour, « Écrire » en haut à droite
 * (décision du 2026-11-05), et deux onglets — Notifications (ce que
 * Filloo m'a envoyé) et Conversation (mon fil privé avec l'équipe).
 * Les onglets REMPLACENT la page dans l'historique : passer de l'un à
 * l'autre n'ajoute pas de retour.
 */
export function EnTeteEquipe({
  espace,
  onglet,
  backHref,
  nonLus,
}: {
  espace: EspaceEquipe;
  onglet: "notifications" | "conversation";
  backHref: string;
  nonLus: number;
}) {
  const chemin = CHEMINS_EQUIPE[espace];
  const onglets = [
    { cle: "notifications", libelle: "Notifications", href: chemin, pastille: nonLus },
    { cle: "conversation", libelle: "Conversation", href: `${chemin}/conversation`, pastille: 0 },
  ] as const;
  return (
    <div className="sticky top-0 z-10">
      <TopBar
        title="Équipe Filloo"
        backHref={backHref}
        className="static border-b-0"
        right={
          <Link
            href={`${chemin}/ecrire?depuis=${onglet}`}
            className="-mr-1 flex h-9 items-center gap-1.5 rounded-full bg-accent px-3.5 text-sm font-semibold text-on-accent"
          >
            <SquarePen size={16} strokeWidth={2.2} aria-hidden />
            Écrire
          </Link>
        }
      />
      <nav aria-label="Équipe Filloo" className="flex border-b border-line bg-surface px-4">
        {onglets.map((o) => (
          <Link
            key={o.cle}
            href={o.href}
            replace
            aria-current={onglet === o.cle ? "page" : undefined}
            className={cn(
              "-mb-px flex h-11 flex-1 items-center justify-center gap-1.5 border-b-2 text-sm font-semibold",
              onglet === o.cle ? "border-accent text-accent" : "border-transparent text-ink-soft",
            )}
          >
            {o.libelle}
            {o.pastille > 0 ? (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1.5 text-2xs font-bold text-on-accent">
                {o.pastille > 99 ? "99+" : o.pastille}
              </span>
            ) : null}
          </Link>
        ))}
      </nav>
    </div>
  );
}
