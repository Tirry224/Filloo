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
 * POURQUOI LE PANNEAU FLOTTE, ET CE QUE ÇA IMPOSE À SON PARENT
 * Il est en `absolute` : il recouvre le haut des résultats sans pousser
 * quoi que ce soit, et il est volontairement étroit et plafonné en hauteur
 * pour qu'on continue de voir la liste derrière. La contrepartie, apprise
 * à l'écran par la v1 du projet : un parent en `overflow-x: auto` le
 * DÉCOUPERAIT, parce que rogner horizontalement rogne aussi verticalement.
 * La rangée qui contient ces puces passe donc à la ligne (`flex-wrap`) au
 * lieu de défiler. Si un jour elle redéfile, ce panneau se coupera.
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
  label,
  selected = false,
  icon: Icon,
  options,
}: {
  /** Ce que la puce affiche fermée : la valeur courante, pas le nom du filtre. */
  label: string;
  /** Foncée quand le filtre s'écarte de sa valeur par défaut. */
  selected?: boolean;
  icon?: LucideIcon;
  options: FilterOption[];
}) {
  return (
    <details data-panneau className="group relative">
      <summary
        className={cn(
          /* `list-none` et le pseudo-élément WebKit retirent le triangle
             par défaut, qui n'existe pas dans le design system. Le chevron
             le remplace, et lui tourne à l'ouverture. */
          "inline-flex cursor-pointer list-none items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-2 text-sm font-medium [&::-webkit-details-marker]:hidden",
          selected ? "border-ink bg-ink text-paper" : "border-line bg-surface text-ink",
        )}
      >
        {Icon ? <Icon size={15} strokeWidth={1.8} aria-hidden /> : null}
        {label}
        <ChevronDown size={15} strokeWidth={2} className="group-open:rotate-180" aria-hidden />
      </summary>

      {/* `max-h` en `vh` et non en pixels : la liste des villes peut
          grandir, et un panneau plus haut que l'écran ne se referme plus
          du pouce. Il défile à l'intérieur, l'écran ne bouge pas. */}
      <div className="absolute left-0 top-full z-10 mt-2 max-h-[55vh] w-60 max-w-[85vw] overflow-y-auto rounded-2xl border border-line bg-surface p-1 shadow-panel">
        {options.map((option) => (
          <Link
            key={option.href}
            href={option.href}
            className="flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-sm"
          >
            <span className={option.selected ? "font-semibold text-accent" : "text-ink"}>{option.label}</span>
            {option.selected ? <Check size={17} strokeWidth={2.4} className="shrink-0 text-accent" aria-hidden /> : null}
          </Link>
        ))}
      </div>
    </details>
  );
}
