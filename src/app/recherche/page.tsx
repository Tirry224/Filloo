import { Search, SlidersHorizontal, X } from "lucide-react";
import { BottomNav } from "@/components/ui/BottomNav";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { EmptyState } from "@/components/ui/EmptyState";
import { Screen, ScreenBody, Section } from "@/components/ui/Screen";
import { TopBar } from "@/components/ui/TopBar";
import { ProductCard } from "@/components/product/ProductCard";
import { createClient } from "@/lib/supabase/server";
import { getCategories, getCities } from "@/lib/data/reference";
import { searchProducts } from "@/lib/data/products";
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
  const { q = "", ville = "Conakry", categorie = "Tout", tri = "recent" } = await searchParams;
  const supabase = await createClient();

  const [cities, categories] = await Promise.all([getCities(supabase), getCategories(supabase)]);
  const city = cities.find((c) => c.name === ville) ?? cities.find((c) => c.name === "Conakry");
  const category = categorie !== "Tout" ? categories.find((c) => c.name === categorie) : undefined;
  const sort = tri === "populaire" ? "popular" : "recent";

  const results = city
    ? await searchProducts(supabase, { query: q, cityId: city.id, categoryId: category?.id ?? null, sort, limit: 50 })
    : [];

  const activeFilterCount = (ville !== "Conakry" ? 1 : 0) + (categorie !== "Tout" ? 1 : 0);

  /* Ces deux liens gardent la recherche tapée — sinon on efface aussi ce
     que la personne cherchait, ce qui n'est pas ce que « filtres » veut
     dire. Deux boutons parce que ce sont deux gestes différents : changer
     de ville en gardant la catégorie choisie, ou tout remettre à zéro. */
  const searchInConakryHref = `/recherche?q=${encodeURIComponent(q)}&ville=Conakry&categorie=${encodeURIComponent(categorie)}&tri=${encodeURIComponent(tri)}`;
  const clearFiltersHref = `/recherche?q=${encodeURIComponent(q)}&ville=Conakry`;

  return (
    <Screen>
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
        <Section className="gap-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-ink-soft">
              <b className="text-ink">
                {results.length} produit{results.length > 1 ? "s" : ""}
              </b>{" "}
              trouvé{results.length > 1 ? "s" : ""}
            </p>
            <Chip
              href={`/recherche/filtres?q=${encodeURIComponent(q)}&ville=${encodeURIComponent(ville)}&categorie=${encodeURIComponent(categorie)}`}
              selected={activeFilterCount > 0}
              icon={SlidersHorizontal}
            >
              Filtres{activeFilterCount > 0 ? ` · ${activeFilterCount}` : ""}
            </Chip>
          </div>

          {/* Les filtres actifs restent visibles : un résultat vide sans
              filtre affiché est incompréhensible — on croit le catalogue
              vide alors qu'on a simplement trop filtré. La catégorie ne
              s'affiche plus en rangée complète (dix puces à faire défiler) :
              elle se choisit dans la feuille « Filtres », et seule celle
              retenue apparaît ici, avec de quoi la retirer d'un tap. Ville
              ouvre sa propre feuille ; Récents/Populaires sont deux puces
              mutuellement exclusives, un choix binaire n'a pas besoin d'une
              feuille pour se faire. */}
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-0.5">
            <Chip
              href={`/recherche/ville?q=${encodeURIComponent(q)}&ville=${encodeURIComponent(ville)}&categorie=${encodeURIComponent(categorie)}&tri=${encodeURIComponent(tri)}`}
              selected
            >
              {ville}
            </Chip>
            <Chip
              href={`/recherche?q=${encodeURIComponent(q)}&ville=${encodeURIComponent(ville)}&categorie=${encodeURIComponent(categorie)}&tri=recent`}
              selected={tri !== "populaire"}
            >
              Récents
            </Chip>
            <Chip
              href={`/recherche?q=${encodeURIComponent(q)}&ville=${encodeURIComponent(ville)}&categorie=${encodeURIComponent(categorie)}&tri=populaire`}
              selected={tri === "populaire"}
            >
              Populaires
            </Chip>
            {categorie !== "Tout" ? (
              <Chip
                href={`/recherche?q=${encodeURIComponent(q)}&ville=${encodeURIComponent(ville)}&categorie=Tout&tri=${encodeURIComponent(tri)}`}
                selected
                icon={X}
              >
                {categorie}
              </Chip>
            ) : null}
          </div>

          {results.length === 0 ? (
            <EmptyState
              icon={Search}
              title={q ? `Aucun résultat pour « ${q} »` : "Aucun produit ici"}
              /* Ce texte disait « retirez le filtre de ville pour chercher
                 dans toute la Guinée » — une action qui n'existe pas et
                 ne peut pas exister : la décision 9 de docs/SPEC.md
                 impose une ville, `searchProducts` exige `cityId`, et la
                 feuille /recherche/ville n'offre aucune option neutre.
                 On demandait à la personne de faire ce que le produit
                 interdit. */
              description="Essayez un mot plus court, ou changez de ville."
            >
              <Button href={searchInConakryHref}>Chercher à Conakry</Button>
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
      </ScreenBody>

      <BottomNav active="search" />
    </Screen>
  );
}
