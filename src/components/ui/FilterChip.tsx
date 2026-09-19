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
 * Une puce de filtre qui ouvre ses options par-dessus les résultats —
 * sans une ligne de JavaScript.
 *
 * POURQUOI `<details>` ET PAS UN ÉTAT REACT
 * `<details>` fait nativement ce qu'on écrirait sinon avec `useState` :
 * ouvrir, fermer, et se replier au clavier comme au doigt. Zéro octet
 * ajouté au socle, et surtout : le panneau s'ouvre AVANT que le JavaScript
 * soit chargé, donc pendant les longues secondes qui comptent sur une
 * connexion guinéenne (`docs/PERFORMANCE.md`, règle R3). Un panneau de
 * filtres qui exige d'attendre le JavaScript est un panneau qui ne sert
 * pas au moment où l'on en a besoin.
 *
 * POURQUOI PAS UNE PAGE, ALORS QUE LE RESTE DE L'APP EN UTILISE
 * Les feuilles de Makiti (`Sheet`) ont chacune leur adresse, et c'est un
 * bon choix quand l'écran REMPLACE le précédent — choisir un motif de
 * signalement, par exemple. Filtrer est différent : on veut voir ce qu'on
 * filtre. Une page entière cache les résultats qu'on essaie justement de
 * réduire, et impose deux navigations (aller, revenir) là où un panneau
 * n'en demande aucune.
 *
 * POURQUOI LE PANNEAU S'OUVRE EN BAS, ET NON SOUS SA PUCE
 * Il l'a d'abord fait, en `absolute`, et c'était intenable : la rangée de
 * puces doit pouvoir défiler horizontalement quand les filtres ne tiennent
 * pas sur une ligne, or un parent en `overflow-x: auto` DÉCOUPE ce qui
 * dépasse — rogner horizontalement rogne aussi verticalement. Le panneau
 * est donc en `fixed`, ce qu'aucun débordement ne coupe, et se place en bas
 * de l'écran comme les feuilles de l'app (`Sheet`) : près du pouce, sur la
 * moitié basse, les résultats restant visibles au-dessus.
 *
 * Détaché de sa puce, il doit dire ce qu'il filtre : d'où le titre, que
 * `Sheet` affiche pour la même raison.
 *
 * FERMER EN TOUCHANT AILLEURS
 * Un `<details>` ne se referme nativement que par sa propre étiquette.
 * C'est déroutant : sur un téléphone, on touche à côté d'une pop-up pour
 * la fermer. L'attribut `data-panneau` signale ce panneau à
 * `ClosePanels`, posé une fois dans le layout racine, qui le referme au
 * tap extérieur et sur Échap. C'est une AMÉLIORATION, pas une dépendance :
 * sans JavaScript, la puce ouvre et ferme toujours son panneau.
 *
 * PAS DE BOUTON « APPLIQUER »
 * Chaque option est un lien : choisir recharge la page, et le panneau
 * repart fermé. Un brouillon de filtres serait un état de plus à gérer,
 * pour trois filtres.
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
          /* `list-none` et le pseudo-élément WebKit retirent le triangle
             par défaut, qui n'existe pas dans le design system. Le chevron
             le remplace, et lui tourne à l'ouverture. */
          "inline-flex shrink-0 cursor-pointer list-none items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-2 text-sm font-medium [&::-webkit-details-marker]:hidden",
          selected ? "border-ink bg-ink text-paper" : "border-line bg-surface text-ink",
        )}
      >
        {Icon ? <Icon size={15} strokeWidth={1.8} aria-hidden /> : null}
        {label}
        <ChevronDown size={15} strokeWidth={2} className="group-open:rotate-180" aria-hidden />
      </summary>

      {/* `fixed` et non `absolute` : c'est ce qui le rend insensible au
          débordement de la rangée de puces. `max-h` en `vh` et non en
          pixels, parce que la liste des villes peut grandir et qu'un
          panneau plus haut que l'écran ne se referme plus du pouce — il
          défile à l'intérieur, l'écran ne bouge pas.

          `z-20` : la barre de navigation du bas n'a pas de plan déclaré,
          donc elle passerait devant sans ça. */}
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
