import type { Metadata } from "next";
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
import { categoriesEnCache, rechercheEnCache, villesEnCache } from "@/lib/data/catalogue-public";
import Link from "next/link";
import { compter } from "@/lib/analytics";
import { premier } from "@/lib/next-param";
import { PLAFOND_RESULTATS } from "@/lib/data/products";

const TOUTES = "Toutes les villes";

/**
 * Une page par recherche (`?q=riz`, `?ville=…`) ferait des milliers de
 * pages presque vides aux yeux de Google : seule `/recherche` nue
 * s'indexe ; les autres se suivent sans s'indexer.
 */
export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
  const filtree = Object.keys(await searchParams).length > 0;
  return {
    title: "Rechercher un produit",
    alternates: { canonical: "/recherche" },
    robots: filtree ? { index: false, follow: true } : undefined,
  };
}

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

  const [cities, categories] = await Promise.all([villesEnCache(), categoriesEnCache()]);

  const villeParam = premier(brut.ville);
  const categorieParam = premier(brut.categorie);
  const categorie = categories.some((c) => c.name === categorieParam) ? categorieParam! : "Tout";
  /* La ville n'est plus qu'un filtre FACULTATIF (décision du 2026-10-22) :
     sans choix, la recherche couvre toute la Guinée. Le profil client ne
     porte plus de ville par défaut. */
  const city = cities.find((c) => c.name === villeParam);
  const ville = city?.name ?? TOUTES;
  const category = categorie !== "Tout" ? categories.find((c) => c.name === categorie) : undefined;
  const sort = tri === "populaire" ? "popular" : "recent";

  const results = await rechercheEnCache({
    query: q,
    cityId: city?.id,
    categoryId: category?.id ?? null,
    sort,
    limit: 50,
  });

  /* Un écran vide avec une ville choisie : la même recherche dans toute la
     Guinée dit si c'est le filtre qui bloque. Sans ville, rien à recompter. */
  const ailleurs =
    results.length === 0 && city
      ? await rechercheEnCache({ query: q, categoryId: category?.id ?? null, sort, limit: PLAFOND_RESULTATS })
      : [];
  const elsewhereCount = ailleurs.length;
  const elsewhereCapped = ailleurs.length >= PLAFOND_RESULTATS;

  if (q || category) {
    compter("recherche", {
      query: q || null,
      categoryId: category?.id ?? null,
      cityId: city?.id ?? null,
      resultCount: results.length,
    });
  }

  const activeFilterCount = (city ? 1 : 0) + (categorie !== "Tout" ? 1 : 0);
  const resting = !q && categorie === "Tout";

  const clearFiltersHref = `/recherche?q=${encodeURIComponent(q)}`;

  const lien = (modifs: { q?: string; ville?: string; categorie?: string; tri?: string }) => {
    const params = new URLSearchParams({
      q: modifs.q ?? q,
      categorie: modifs.categorie ?? categorie,
      tri: modifs.tri ?? tri,
    });
    const villeLien = modifs.ville ?? ville;
    if (villeLien !== TOUTES) params.set("ville", villeLien);
    return `/recherche?${params.toString()}`;
  };

  return (
    <TabScreen largeur="grille">
      <TopBar
        title={
          <form action="/recherche" method="get" className="flex h-tap flex-1 items-center gap-2.5 rounded-lg border border-line bg-surface px-3.5">
            {city ? <input type="hidden" name="ville" value={city.name} /> : null}
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
                href={lien({ q: "" })}
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
            <CategoryGrid categories={categories} />
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
                selected={Boolean(city)}
                icon={MapPin}
                options={[
                  { label: TOUTES, href: lien({ ville: TOUTES }), selected: !city },
                  ...cities.map((c) => ({
                    label: c.name,
                    href: lien({ ville: c.name }),
                    selected: c.name === ville,
                  })),
                ]}
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
                      `${elsewhereCount}${elsewhereCapped ? " produits ou plus correspondent" : ` produit${elsewhereCount > 1 ? "s" : ""} correspond${elsewhereCount > 1 ? "ent" : ""}`} ailleurs en Guinée. C'est le filtre de ville qui bloque, pas votre recherche.`
                    : "Essayez un mot plus court, ou une autre catégorie."
                }
              >
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
