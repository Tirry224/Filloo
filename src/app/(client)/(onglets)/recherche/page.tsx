import { ArrowUpDown, MapPin, Search, SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { FilterChip } from "@/components/ui/FilterChip";
import { EmptyState } from "@/components/ui/EmptyState";
import { ScreenBody, Section } from "@/components/ui/Screen";
import { TopBar } from "@/components/ui/TopBar";
import { ProductCard } from "@/components/product/ProductCard";
import { CategoryGrid } from "@/components/product/CategoryGrid";
import { RecentSearches } from "@/components/product/RecentSearches";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { createClient } from "@/lib/supabase/server";
import { FALLBACK_CITY, getCategories, getCities, getDefaultCityName } from "@/lib/data/reference";
import { countProductsElsewhere, searchProducts } from "@/lib/data/products";
import Link from "next/link";
import { compter } from "@/lib/analytics";

/**
 * Recherche — écrans 5 et 6 de docs/ECRANS.md.
 *
 * `search_products` (0003_search_and_seed.sql) porte toute la logique —
 * titre, description et nom de boutique, sans accent ni casse, ville,
 * catégorie — vérifiée par `supabase/tests/security_test.sql`. Cette page ne
 * fait que résoudre les noms de l'URL en identifiants et afficher le résultat.
 */
export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; ville?: string; categorie?: string; tri?: string }>;
}) {
  const { q = "", ville: villeParam, categorie = "Tout", tri = "recent" } = await searchParams;
  const supabase = await createClient();

  const [cities, categories] = await Promise.all([getCities(supabase), getCategories(supabase)]);

  /* La ville de départ est résolue au même endroit pour les deux écrans
     (`getDefaultCityName`), sinon on perd sa ville en changeant d'onglet.
     `?ville=` gagne toujours, et se choisit dans le panneau de la puce. */
  const defaultVille = await getDefaultCityName(supabase, cities);
  const ville = villeParam ?? defaultVille;
  const city = cities.find((c) => c.name === ville) ?? cities.find((c) => c.name === FALLBACK_CITY);
  const category = categorie !== "Tout" ? categories.find((c) => c.name === categorie) : undefined;
  const sort = tri === "populaire" ? "popular" : "recent";

  const results = city
    ? await searchProducts(supabase, { query: q, cityId: city.id, categoryId: category?.id ?? null, sort, limit: 50 })
    : [];

  // Un résultat vide dû au filtre de ville, pas à la recherche elle-même,
  // se chiffre plutôt que de laisser croire au catalogue vide — jamais
  // affiché sans ce chiffre (décision 9 : filtre manuel, jamais automatique).
  const ailleurs =
    results.length === 0
      ? await countProductsElsewhere(supabase, { query: q, categoryId: category?.id ?? null })
      : { nombre: 0, atteintLePlafond: false };
  const elsewhereCount = ailleurs.nombre;

  /* La mesure la plus utile du lot : une recherche à zéro résultat nomme
     un commerçant à aller chercher. Seulement quand quelque chose a été
     réellement demandé — l'écran de repos n'est pas une recherche. */
  if (q || category) {
    compter("recherche", {
      query: q || null,
      categoryId: category?.id ?? null,
      cityId: city?.id ?? null,
      resultCount: results.length,
    });
  }

  // « Filtre actif » = différent de ce qu'on aurait sans rien toucher :
  // pour un client de Boké, sa propre ville n'est pas un filtre posé.
  const activeFilterCount = (ville !== defaultVille ? 1 : 0) + (categorie !== "Tout" ? 1 : 0);
  // Écran de repos : montrer des produits ici les ferait passer pour des
  // résultats.
  const resting = !q && categorie === "Tout";

  /* Les deux gardent la recherche tapée : « filtres » ne veut pas dire ce
     qu'on cherchait. Deux boutons pour deux gestes : changer de ville en
     gardant la catégorie, ou tout remettre à zéro. */
  const searchInConakryHref = `/recherche?q=${encodeURIComponent(q)}&ville=${encodeURIComponent(FALLBACK_CITY)}&categorie=${encodeURIComponent(categorie)}&tri=${encodeURIComponent(tri)}`;
  // « Effacer les filtres » remet la ville de DÉPART, pas Conakry : on
  // n'efface pas un filtre que la personne n'a pas posé.
  const clearFiltersHref = `/recherche?q=${encodeURIComponent(q)}&ville=${encodeURIComponent(defaultVille)}`;

  // Une seule fonction pour TOUTES les URL de filtre : recopiées, l'une
  // oublierait de reporter `q`, ce qui ne se remarque qu'en production.
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
    <>
      <TopBar
        title={
          /* `method="get"` sur un vrai <form> : la recherche marche sans
             JavaScript et reste dans l'URL, donc partageable. Les trois
             champs cachés reportent ville, catégorie et tri — chercher ne
             doit pas réinitialiser ce qu'on avait réglé. */
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
            {/* Mémoire silencieuse : cette recherche a été réellement
                lancée, elle mérite d'être retenue. */}
            <RecentSearches q={q} show={false} />

            <p className="text-sm text-ink-soft">
              <b className="text-ink">
                {results.length} produit{results.length > 1 ? "s" : ""}
              </b>{" "}
              trouvé{results.length > 1 ? "s" : ""}
              {activeFilterCount > 0 ? ` · ${activeFilterCount} filtre${activeFilterCount > 1 ? "s" : ""}` : ""}
            </p>

            {/* Les filtres s'ouvrent PAR-DESSUS les résultats plutôt que sur
                une page qui les cache : on voit ce qu'on filtre pendant qu'on
                filtre. La rangée tient sur UNE ligne et défile au doigt —
                repliée, elle ferait sauter les résultats de deux lignes au
                quatrième filtre. Possible parce que les panneaux sont en
                `fixed` et s'ouvrent en bas : ancré sous sa puce, un panneau
                serait découpé par ce débordement. */}
            <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-0.5">
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
            </div>

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
                {/* Proposer « Chercher à Conakry » à quelqu'un qui y cherche
                    DÉJÀ est un bouton qui ne fait rien : la plus grosse ville
                    du catalogue ne se suggère qu'à qui est ailleurs. */}
                {elsewhereCount === 0 && ville !== FALLBACK_CITY ? (
                  <Button href={searchInConakryHref}>Chercher à {FALLBACK_CITY}</Button>
                ) : null}
                <Button variant="secondary" href={clearFiltersHref}>
                  Effacer les filtres
                </Button>
              </EmptyState>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {results.map((p) => (
                  <ProductCard key={p.id} product={p} />
                ))}
              </div>
            )}
          </Section>
        )}
      </ScreenBody>
    </>
  );
}
