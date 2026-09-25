import { ArrowUpDown, MapPin, Search, SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { FilterChip } from "@/components/ui/FilterChip";
import { ChipRow } from "@/components/ui/Chip";
import { EmptyState } from "@/components/ui/EmptyState";
import { ScreenBody, Section, TabScreen } from "@/components/ui/Screen";
import { TopBar } from "@/components/ui/TopBar";
import { ProductCard } from "@/components/product/ProductCard";
import { ProductGrid } from "@/components/product/ProductGrid";
import { CategoryGrid } from "@/components/product/CategoryGrid";
import { RecentSearches } from "@/components/product/RecentSearches";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { createClient } from "@/lib/supabase/server";
import { FALLBACK_CITY, getCategories, getCities, getDefaultCityName } from "@/lib/data/reference";
import { countProductsElsewhere, searchProducts } from "@/lib/data/products";
import Link from "next/link";
import { compter } from "@/lib/analytics";
import { premier } from "@/lib/next-param";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[]; ville?: string | string[]; categorie?: string | string[]; tri?: string | string[] }>;
}) {
  /* Un paramètre répété (`?q=riz&q=huile`) arrive en TABLEAU : il faisait
     planter `RecentSearches` sur `q.trim`. Une ville ou une catégorie
     inconnue (`?categorie=abc`) s'affichait comme un filtre actif qui ne
     filtrait rien. Constaté le 2026-09-25. */
  const brut = await searchParams;
  const q = premier(brut.q) ?? "";
  const tri = premier(brut.tri) ?? "recent";
  const supabase = await createClient();

  const [cities, categories] = await Promise.all([getCities(supabase), getCategories(supabase)]);

  const villeParam = premier(brut.ville);
  const categorieParam = premier(brut.categorie);
  const categorie = categories.some((c) => c.name === categorieParam) ? categorieParam! : "Tout";
  const defaultVille = await getDefaultCityName(supabase, cities);
  const ville = cities.some((c) => c.name === villeParam) ? villeParam! : defaultVille;
  const city = cities.find((c) => c.name === ville) ?? cities.find((c) => c.name === FALLBACK_CITY);
  const category = categorie !== "Tout" ? categories.find((c) => c.name === categorie) : undefined;
  const sort = tri === "populaire" ? "popular" : "recent";

  const results = city
    ? await searchProducts(supabase, { query: q, cityId: city.id, categoryId: category?.id ?? null, sort, limit: 50 })
    : [];

  const ailleurs =
    results.length === 0
      ? await countProductsElsewhere(supabase, { query: q, categoryId: category?.id ?? null })
      : { nombre: 0, atteintLePlafond: false };
  const elsewhereCount = ailleurs.nombre;

  if (q || category) {
    compter("recherche", {
      query: q || null,
      categoryId: category?.id ?? null,
      cityId: city?.id ?? null,
      resultCount: results.length,
    });
  }

  const activeFilterCount = (ville !== defaultVille ? 1 : 0) + (categorie !== "Tout" ? 1 : 0);
  const resting = !q && categorie === "Tout";

  const searchInConakryHref = `/recherche?q=${encodeURIComponent(q)}&ville=${encodeURIComponent(FALLBACK_CITY)}&categorie=${encodeURIComponent(categorie)}&tri=${encodeURIComponent(tri)}`;
  const clearFiltersHref = `/recherche?q=${encodeURIComponent(q)}&ville=${encodeURIComponent(defaultVille)}`;

  const lien = (modifs: { ville?: string; categorie?: string; tri?: string }) => {
    const params = new URLSearchParams({
      q,
      ville: modifs.ville ?? ville,
      categorie: modifs.categorie ?? categorie,
      tri: modifs.tri ?? tri,
    });
    return `/recherche?${params.toString()}`;
  };

  return (
    <TabScreen largeur="grille">
      <TopBar
        title={
          <form action="/recherche" method="get" className="flex h-tap flex-1 items-center gap-2.5 rounded-lg border border-line bg-surface px-3.5">
            <input type="hidden" name="ville" value={ville} />
            <input type="hidden" name="categorie" value={categorie} />
            <input type="hidden" name="tri" value={tri} />
            <button type="submit" aria-label="Lancer la recherche" className="shrink-0 text-ink-soft">
              <Search size={18} strokeWidth={1.8} aria-hidden />
            </button>
            <input
              type="search"
              name="q"
              defaultValue={q}
              enterKeyHint="search"
              autoComplete="off"
              placeholder="Rechercher un produit"
              aria-label="Rechercher un produit"
              className="h-full min-w-0 flex-1 bg-transparent text-base font-medium outline-none placeholder:font-normal placeholder:text-ink-soft"
            />
            {q ? (
              <Link
                href={`/recherche?ville=${encodeURIComponent(ville)}&categorie=${encodeURIComponent(categorie)}&tri=${encodeURIComponent(tri)}`}
                aria-label="Effacer la recherche"
                className="shrink-0 text-ink-soft"
              >
                <X size={17} strokeWidth={2} aria-hidden />
              </Link>
            ) : null}
          </form>
        }
      />

      <ScreenBody>
        {resting ? (
          <Section className="gap-4">
            <RecentSearches q="" show />
            <SectionLabel>Parcourir</SectionLabel>
            <CategoryGrid categories={categories} ville={ville} />
          </Section>
        ) : (
          <Section className="gap-3">
            <RecentSearches q={q} show={false} />

            <p className="text-sm text-ink-soft">
              <b className="text-ink">
                {results.length} produit{results.length > 1 ? "s" : ""}
              </b>{" "}
              trouvé{results.length > 1 ? "s" : ""}
              {activeFilterCount > 0 ? ` · ${activeFilterCount} filtre${activeFilterCount > 1 ? "s" : ""}` : ""}
            </p>

            <ChipRow>
              <FilterChip
                title="Ville"
                label={ville}
                selected={ville !== defaultVille}
                icon={MapPin}
                options={cities.map((c) => ({
                  label: c.name,
                  href: lien({ ville: c.name }),
                  selected: c.name === ville,
                }))}
              />
              <FilterChip
                title="Catégorie"
                label={categorie === "Tout" ? "Catégorie" : categorie}
                selected={categorie !== "Tout"}
                icon={SlidersHorizontal}
                options={[
                  { label: "Toutes catégories", href: lien({ categorie: "Tout" }), selected: categorie === "Tout" },
                  ...categories.map((c) => ({
                    label: c.name,
                    href: lien({ categorie: c.name }),
                    selected: c.name === categorie,
                  })),
                ]}
              />
              <FilterChip
                title="Trier par"
                label={tri === "populaire" ? "Populaires" : "Récents"}
                icon={ArrowUpDown}
                options={[
                  { label: "Récents", href: lien({ tri: "recent" }), selected: tri !== "populaire" },
                  { label: "Populaires", href: lien({ tri: "populaire" }), selected: tri === "populaire" },
                ]}
              />
            </ChipRow>

            {results.length === 0 ? (
              <EmptyState
                icon={Search}
                title={q ? `Aucun résultat pour « ${q} »` : "Aucun produit ici"}
                description={
                  elsewhereCount > 0
                    ? /* « et plus » quand le compte touche le plafond de
                         `search_products` : au-delà, le nombre exact n'est
                         pas connu, et l'annoncer serait inventer. */
                      `${elsewhereCount}${ailleurs.atteintLePlafond ? " produits ou plus correspondent" : ` produit${elsewhereCount > 1 ? "s" : ""} correspond${elsewhereCount > 1 ? "ent" : ""}`} ailleurs en Guinée. C'est le filtre de ville qui bloque, pas votre recherche.`
                    : "Essayez un mot plus court, ou changez de ville."
                }
              >
                {elsewhereCount === 0 && ville !== FALLBACK_CITY ? (
                  <Button href={searchInConakryHref}>Chercher à {FALLBACK_CITY}</Button>
                ) : null}
                <Button variant="secondary" href={clearFiltersHref}>
                  Effacer les filtres
                </Button>
              </EmptyState>
            ) : (
              <ProductGrid>
                {results.map((p) => (
                  <ProductCard key={p.id} product={p} />
                ))}
              </ProductGrid>
            )}
          </Section>
        )}
      </ScreenBody>
    </TabScreen>
  );
}
