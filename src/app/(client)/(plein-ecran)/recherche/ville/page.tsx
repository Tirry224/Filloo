import Link from "next/link";
import { Check } from "lucide-react";
import { Sheet } from "@/components/ui/Sheet";
import { createClient } from "@/lib/supabase/server";
import { getCities } from "@/lib/data/reference";

/**
 * Choix de la ville — même principe que `/recherche/filtres` : une vraie
 * feuille, sa propre adresse, plutôt qu'un état caché dans la page.
 * Séparée de la feuille « Filtres » plutôt que fusionnée avec elle : la
 * ville et la catégorie répondent à deux questions différentes (« où » et
 * « quoi »), chacune garde son bouton d'entrée sur l'écran de recherche.
 */
export default async function SearchCityPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; ville?: string; categorie?: string; tri?: string }>;
}) {
  const { q = "", ville = "Conakry", categorie = "Tout", tri = "recent" } = await searchParams;
  const supabase = await createClient();
  const cities = await getCities(supabase);

  function hrefFor(cityName: string) {
    return `/recherche?q=${encodeURIComponent(q)}&ville=${encodeURIComponent(cityName)}&categorie=${encodeURIComponent(categorie)}&tri=${encodeURIComponent(tri)}`;
  }

  return (
    <Sheet title="Ville" closeHref={hrefFor(ville)}>
      <div className="-mt-1 flex flex-col">
        {cities.map((city) => {
          const isSelected = city.name === ville;
          return (
            <Link
              key={city.id}
              href={hrefFor(city.name)}
              className="flex items-center justify-between border-b border-line py-3.5 text-base last:border-b-0"
            >
              <span className={isSelected ? "font-semibold text-accent" : "text-ink"}>{city.name}</span>
              {isSelected ? <Check size={19} strokeWidth={2.4} className="text-accent" aria-hidden /> : null}
            </Link>
          );
        })}
      </div>
    </Sheet>
  );
}
