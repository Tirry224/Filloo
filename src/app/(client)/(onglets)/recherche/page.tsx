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

/**
 * Recherche — écrans 5 et 6 de docs/ECRANS.md.
 *
 * `search_products` (0003_search_and_seed.sql) porte déjà toute la
 * logique — texte sans accent/casse, ville, catégorie — donc cette page
 * ne fait que résoudre les noms de l'URL en identifiants et afficher le
 * résultat. Le comportement décrit dans le commentaire d'origine du
 * fichier (recherche sur titre/description/boutique, insensible aux
 * accents) n'a pas changé : il vit maintenant dans la fonction SQL,
 * vérifié par les tests de `supabase/tests/security_test.sql`.
 */
export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; ville?: string; categorie?: string; tri?: string }>;
}) {
  const { q = "", ville: villeParam, categorie = "Tout", tri = "recent" } = await searchParams;
  const supabase = await createClient();

  const [cities, categories] = await Promise.all([getCities(supabase), getCategories(supabase)]);

  /* Cet écran avait son propre "Conakry" en dur, indépendant de celui du
     fil d'accueil : un client de Boké voyait son fil à Boké, touchait
     l'onglet « Rechercher », et se retrouvait à Conakry sans avoir rien
     demandé — sa ville perdue en changeant d'onglet.

     La ville de départ est désormais résolue au même endroit pour les deux
     écrans (`getDefaultCityName`). Changer de ville reste possible et
     manuel : `?ville=` gagne toujours, et se choisit maintenant dans le
     panneau de la puce « ville » plutôt que sur une page à part. */
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
  const elsewhereCount =
    results.length === 0 ? await countProductsElsewhere(supabase, { query: q, categoryId: category?.id ?? null }) : 0;

  /* « Filtre actif » veut dire « différent de ce qu'on aurait sans rien
     toucher », pas « différent de Conakry » : pour un client de Boké, sa
     propre ville n'est pas un filtre qu'il a posé. Le chiffre suit donc la
     ville de départ, comme le reste de l'écran. */
  const activeFilterCount = (ville !== defaultVille ? 1 : 0) + (categorie !== "Tout" ? 1 : 0);
  // Écran de repos : rien à afficher, tout à proposer. Le fil d'accueil
  // montre déjà des produits ; en montrer ici ferait croire à des résultats.
  const resting = !q && categorie === "Tout";

  /* Ces deux liens gardent la recherche tapée — sinon on efface aussi ce
     que la personne cherchait, ce qui n'est pas ce que « filtres » veut
     dire. Deux boutons parce que ce sont deux gestes différents : changer
     de ville en gardant la catégorie choisie, ou tout remettre à zéro. */
  const searchInConakryHref = `/recherche?q=${encodeURIComponent(q)}&ville=${encodeURIComponent(FALLBACK_CITY)}&categorie=${encodeURIComponent(categorie)}&tri=${encodeURIComponent(tri)}`;
  // « Effacer les filtres » remet la ville de DÉPART, pas Conakry : effacer
  // un filtre qu'on n'a pas posé reviendrait à déplacer quelqu'un de chez
  // lui pour lui rendre service.
  const clearFiltersHref = `/recherche?q=${encodeURIComponent(q)}&ville=${encodeURIComponent(defaultVille)}`;

  /* Une seule fonction construit TOUTES les URL de filtre. Les recopier à
     la main, c'est la certitude qu'un jour l'une d'elles oubliera de
     reporter `q` — et effacer la recherche de quelqu'un parce qu'il a
     changé de ville est le genre de défaut qu'on ne remarque qu'en
     production. */
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
          /* Cette barre AFFICHAIT la recherche sans jamais permettre de la
             taper : un <div> contenant un <span>, aucun <input>, aucun
             <form>. `q` n'était donc renseignable qu'en écrivant l'URL à
             la main, et `search_products` — la fonction SQL qui cherche
             dans le titre, la description et le nom de boutique, sans
             accents ni casse — restait inatteignable depuis l'écran qui
             existe pour elle. La croix « Effacer la recherche »
             apparaissait pourtant dès que `q` était rempli : l'écran
             était construit autour d'un champ qui n'a jamais été posé.

             `method="get"` sur un vrai <form> : la recherche marche sans
             JavaScript, comme le reste des formulaires du projet, et la
             requête reste dans l'URL donc partageable et revenable. Les
             trois champs cachés reportent ville, catégorie et tri —
             chercher ne doit pas réinitialiser ce qu'on avait réglé. */
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
          // État de repos : rien à afficher, tout à proposer. Montrer des
          // produits ici ferait croire à des résultats de recherche.
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

            {/* Les trois filtres s'ouvrent PAR-DESSUS les résultats, chacun
                dans son panneau, au lieu d'envoyer sur une page qui les
                cache. On voit ce qu'on filtre pendant qu'on filtre, et
                aucune navigation n'est nécessaire pour revenir.

                La rangée passe à la ligne (`flex-wrap`) et ne défile PAS :
                un parent en `overflow-x: auto` découperait les panneaux,
                parce que rogner horizontalement rogne aussi verticalement.
                C'est écrit ici parce que la contrainte porte sur ce
                conteneur, pas sur les puces. */}
            <div className="flex flex-wrap items-center gap-2">
              <FilterChip
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
                    ? `${elsewhereCount} produit${elsewhereCount > 1 ? "s" : ""} correspond${elsewhereCount > 1 ? "ent" : ""} ailleurs en Guinée. C'est le filtre de ville qui bloque, pas votre recherche.`
                    : "Essayez un mot plus court, ou changez de ville."
                }
              >
                {/* Proposer « Chercher à Conakry » à quelqu'un qui cherche
                    DÉJÀ à Conakry est un bouton qui ne fait rien : la plus
                    grosse ville du catalogue reste la bonne suggestion,
                    mais seulement pour qui est ailleurs. */}
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
