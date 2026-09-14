import Link from "next/link";
import {
  Baby,
  Car,
  Dumbbell,
  Hammer,
  Home,
  Shirt,
  Smartphone,
  Sparkles,
  Tag,
  Utensils,
  type LucideIcon,
} from "lucide-react";
import type { CategoryOption } from "@/lib/data/reference";

/** Icône par catégorie, reconnue à un mot du nom plutôt qu'à un slug — les
 * 10 catégories de `0003_search_and_seed.sql` n'en portent pas. Une
 * catégorie qui ne matche rien reçoit `Tag`, jamais une erreur. */
const ICONS: { mot: string; icon: LucideIcon }[] = [
  { mot: "alimentation", icon: Utensils },
  { mot: "vêtements", icon: Shirt },
  { mot: "électronique", icon: Smartphone },
  { mot: "beauté", icon: Sparkles },
  { mot: "maison", icon: Home },
  { mot: "matériaux", icon: Hammer },
  { mot: "enfants", icon: Baby },
  { mot: "sport", icon: Dumbbell },
  { mot: "véhicules", icon: Car },
];

function iconFor(name: string): LucideIcon {
  return ICONS.find((c) => name.toLowerCase().includes(c.mot))?.icon ?? Tag;
}

const classes = {
  grid: "grid grid-cols-2 gap-2",
  tile: "flex items-center gap-2.5 rounded-xl border border-line bg-surface px-3 py-3 text-sm font-semibold",
  icon: "shrink-0 text-accent",
  label: "leading-tight",
};

/** Les catégories en pavés — entrée de la recherche au repos. `ville` est
 * reportée dans chaque lien pour ne pas défaire un choix déjà fait. */
export function CategoryGrid({ categories, ville }: { categories: CategoryOption[]; ville: string }) {
  return (
    <div className={classes.grid}>
      {categories.map((c) => {
        const Icon = iconFor(c.name);
        const href = `/recherche?categorie=${encodeURIComponent(c.name)}&ville=${encodeURIComponent(ville)}`;
        return (
          <Link key={c.id} href={href} className={classes.tile}>
            <Icon size={18} strokeWidth={1.7} aria-hidden className={classes.icon} />
            <span className={classes.label}>{c.name}</span>
          </Link>
        );
      })}
    </div>
  );
}
