import Link from "next/link";
import { Check } from "lucide-react";
import { Sheet } from "@/components/ui/Sheet";
import { createClient } from "@/lib/supabase/server";
import { getCategories } from "@/lib/data/reference";

/**
 * Filtres de recherche — pour l'instant, seulement la catégorie (ville et
 * tri restent affichés mais pas choisissables depuis l'écran de recherche,
 * voir son commentaire). Une vraie feuille, avec sa propre adresse
 * (`/recherche/filtres?...`), plutôt qu'un état caché dans la page — même
 * principe que les autres feuilles de l'app (voir `Sheet`) : le bouton
 * « retour » du téléphone la referme sans code, et dix catégories dans une
 * liste verticale se parcourent mieux qu'une rangée qu'il faut faire
 * défiler au doigt.
 */
export default async function SearchFiltersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; ville?: string; categorie?: string; tri?: string }>;
}) {
  const { q = "", ville = "Conakry", categorie = "Tout", tri = "recent" } = await searchParams;
  const supabase = await createClient();
  const categories = await getCategories(supabase);

  function hrefFor(name: string) {
    return `/recherche?q=${encodeURIComponent(q)}&ville=${encodeURIComponent(ville)}&categorie=${encodeURIComponent(name)}&tri=${encodeURIComponent(tri)}`;
  }

  const options = [
    { value: "Tout", label: "Toutes catégories" },
    ...categories.map((c) => ({ value: c.name, label: c.name })),
  ];

  return (
    <Sheet title="Catégorie" closeHref={hrefFor(categorie)}>
      <div className="-mt-1 flex flex-col">
        {options.map((option) => {
          const isSelected = option.value === categorie;
          return (
            <Link
              key={option.value}
              href={hrefFor(option.value)}
              className="flex items-center justify-between border-b border-line py-3.5 text-base last:border-b-0"
            >
              <span className={isSelected ? "font-semibold text-accent" : "text-ink"}>{option.label}</span>
              {isSelected ? <Check size={19} strokeWidth={2.4} className="text-accent" aria-hidden /> : null}
            </Link>
          );
        })}
      </div>
    </Sheet>
  );
}
