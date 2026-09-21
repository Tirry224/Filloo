import Link from "next/link";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";
import type { LucideIcon } from "lucide-react";

export type FilterOption = {
  /** Ce qui s'affiche dans la liste. */
  label: string;
  /** L'URL de recherche que ce choix produit. Un filtre EST un lien. */
  href: string;
  selected?: boolean;
};

/**
 * Une puce de filtre qui ouvre ses options par-dessus les résultats, sans
 * une ligne de JavaScript.
 *
 * `<details>` et non un état React : zéro octet au socle, et le panneau
 * s'ouvre avant que le JavaScript soit chargé (R3). Un panneau et non une
 * page : filtrer suppose de voir ce qu'on filtre.
 *
 * En bas de l'écran et non sous sa puce : la rangée défile
 * horizontalement, et un parent en `overflow-x: auto` rogne aussi
 * verticalement. Détaché de sa puce, le panneau doit dire ce qu'il
 * filtre — d'où le titre.
 *
 * `data-panneau` le signale à `ClosePanels`, qui le referme au tap
 * extérieur et sur Échap : une amélioration, pas une dépendance.
 *
 * Pas de bouton « Appliquer » : chaque option est un lien, donc choisir
 * recharge la page et le panneau repart fermé.
 */
export function FilterChip({
  title,
  label,
  selected = false,
  icon: Icon,
  options,
}: {
  /** Le nom du filtre — « Ville », « Catégorie » — affiché en tête du panneau. */
  title: string;
  /** Ce que la puce affiche fermée : la valeur courante, pas le nom du filtre. */
  label: string;
  /** Foncée quand le filtre s'écarte de sa valeur par défaut. */
  selected?: boolean;
  icon?: LucideIcon;
  options: FilterOption[];
}) {
  return (
    <details data-panneau className="group">
      <summary
        className={cn(
          // `list-none` et le pseudo-élément WebKit retirent le triangle
          // par défaut, absent du design system ; le chevron le remplace.
          "inline-flex shrink-0 cursor-pointer list-none items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-2 text-sm font-medium [&::-webkit-details-marker]:hidden",
          selected ? "border-ink bg-ink text-paper" : "border-line bg-surface text-ink",
        )}
      >
        {Icon ? <Icon size={15} strokeWidth={1.8} aria-hidden /> : null}
        {label}
        <ChevronDown size={15} strokeWidth={2} className="group-open:rotate-180" aria-hidden />
      </summary>

      {/* `fixed` et non `absolute` : insensible au débordement de la
          rangée de puces. `max-h` en `vh` : la liste des villes peut
          grandir, et un panneau plus haut que l'écran ne se referme plus
          du pouce. `z-20` : sans ça, la barre de navigation du bas, sans
          plan déclaré, passerait devant. */}
      <div className="fixed inset-x-0 bottom-0 z-20 mx-auto flex max-h-[55vh] w-full max-w-app flex-col rounded-t-2xl border-t border-line bg-surface shadow-sheet">
        <p className="shrink-0 px-4.5 pt-3.5 pb-2 text-sm font-bold">{title}</p>
        <div className="overflow-y-auto px-2.5 pb-5">
          {options.map((option) => (
            <Link
              key={option.href}
              href={option.href}
              className="flex items-center justify-between gap-3 rounded-xl px-2 py-3 text-base"
            >
              <span className={option.selected ? "font-semibold text-accent" : "text-ink"}>{option.label}</span>
              {option.selected ? (
                <Check size={18} strokeWidth={2.4} className="shrink-0 text-accent" aria-hidden />
              ) : null}
            </Link>
          ))}
        </div>
      </div>
    </details>
  );
}
