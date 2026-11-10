import Link from "next/link";
import {
  Baby,
  Dumbbell,
  Footprints,
  Gem,
  Glasses,
  Shirt,
  ShoppingBag,
  Sparkles,
  User,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import type { CategoryOption } from "@/lib/data/reference";
import { FAMILLES, GENRES_FILTRE, type Famille } from "@/lib/mode";
import { SectionLabel } from "@/components/ui/SectionLabel";

/** Icône par catégorie, reconnue à un mot du nom (une catégorie créée par
 * l'équipe n'a pas d'icône à elle). Sinon, celle de son rayon. */
const ICONS: { mot: string; icon: LucideIcon }[] = [
  { mot: "sport", icon: Dumbbell },
  { mot: "traditionn", icon: Sparkles },
  { mot: "bijoux", icon: Gem },
  { mot: "lunettes", icon: Glasses },
];

const ICONE_FAMILLE: Record<Famille, LucideIcon> = {
  vetements: Shirt,
  chaussures: Footprints,
  accessoires: ShoppingBag,
};

function iconFor(c: CategoryOption): LucideIcon {
  return ICONS.find((i) => c.name.toLowerCase().includes(i.mot))?.icon ?? ICONE_FAMILLE[c.famille];
}

const ICONE_GENRE: Record<string, LucideIcon> = { femme: UserRound, homme: User, enfant: Baby };

const classes = {
  grid: "grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4",
  tile: "flex items-center gap-2.5 rounded-xl border border-line bg-surface px-3 py-3 text-sm font-semibold",
  icon: "shrink-0 text-accent",
  label: "leading-tight",
};

/** Femme, Homme, Enfant : l'entrée par genre de l'écran de recherche. */
export function GenreTiles() {
  return (
    <div className="grid grid-cols-3 gap-2">
      {GENRES_FILTRE.map((g) => {
        const Icon = ICONE_GENRE[g.valeur] ?? User;
        return (
          <Link key={g.valeur} href={`/recherche?q=&genre=${g.valeur}`} className={classes.tile}>
            <Icon size={18} strokeWidth={1.7} aria-hidden className={classes.icon} />
            <span className={classes.label}>{g.libelle}</span>
          </Link>
        );
      })}
    </div>
  );
}

/** Les catégories rangées par rayon : vêtements, chaussures, accessoires. */
export function CategoryGrid({ categories }: { categories: CategoryOption[] }) {
  return (
    <>
      {FAMILLES.map((f) => {
        const duRayon = categories.filter((c) => c.famille === f.valeur);
        if (duRayon.length === 0) return null;
        return (
          <div key={f.valeur} className="flex flex-col gap-2">
            <SectionLabel>{f.libelle}</SectionLabel>
            <div className={classes.grid}>
              {duRayon.map((c) => {
                const Icon = iconFor(c);
                const href = `/recherche?categorie=${encodeURIComponent(c.name)}`;
                return (
                  <Link key={c.id} href={href} className={classes.tile}>
                    <Icon size={18} strokeWidth={1.7} aria-hidden className={classes.icon} />
                    <span className={classes.label}>{c.name}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        );
      })}
    </>
  );
}
