import type { Metadata } from "next";
import { ArrowUpDown, Banknote, Palette, Ruler, Search, SlidersHorizontal, User, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { FilterChip } from "@/components/ui/FilterChip";
import { ChipRow } from "@/components/ui/Chip";
import { EmptyState } from "@/components/ui/EmptyState";
import { ScreenBody, Section, TabScreen } from "@/components/ui/Screen";
import { TopBar } from "@/components/ui/TopBar";
import { CARTES_PRIORITAIRES, ProductCard } from "@/components/product/ProductCard";
import { ProductGrid } from "@/components/product/ProductGrid";
import { CategoryGrid, GenreTiles } from "@/components/product/CategoryGrid";
import { RecentSearches } from "@/components/product/RecentSearches";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { categoriesEnCache, rechercheEnCache } from "@/lib/data/catalogue-public";
import Link from "next/link";
import { compter } from "@/lib/analytics";
import { goutsDeLaRequete } from "@/lib/data/gouts-serveur";
import { melanger } from "@/lib/melange";
import { compterAffichages, produitsSponsorises } from "@/lib/data/publicite";
import { premier } from "@/lib/next-param";
import { estFiltree } from "@/lib/seo";
import {
  COULEURS,
  GENRES_FILTRE,
  libelleGenre,
  lireTranchePrix,
  NOMS_COULEURS,
  aPlat,
  groupesDeTailles,
  TRANCHES_PRIX,
} from "@/lib/mode";


/**
 * Une page par recherche (`?q=riz`, `?categorie=…`) ferait des milliers de
 * pages presque vides aux yeux de Google : seule `/recherche` nue
 * s'indexe ; les autres se suivent sans s'indexer.
 */
export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
  const filtree = estFiltree(await searchParams, ["q", "genre", "categorie", "taille", "couleur", "prix", "tri"]);
  return {
    title: "Rechercher un vêtement",
    alternates: { canonical: "/recherche" },
    robots: filtree ? { index: false, follow: true } : undefined,
  };
}

type Params = {
  q?: string | string[];
  genre?: string | string[];
  categorie?: string | string[];
  taille?: string | string[];
  couleur?: string | string[];
  prix?: string | string[];
  tri?: string | string[];
};

export default async function SearchPage({ searchParams }: { searchParams: Promise<Params> }) {
  /* Un paramètre répété (`?q=riz&q=huile`) arrive en TABLEAU : il faisait
     planter `RecentSearches` sur `q.trim`. Une valeur inconnue
     (`?categorie=abc`, `?taille=99`) s'affichait comme un filtre actif qui
     ne filtrait rien : chaque filtre est relu contre sa liste et ignoré
     s'il n'y est pas. Constaté le 2026-09-25. */
  const brut = await searchParams;
  const q = premier(brut.q) ?? "";
  // « Pour vous » (le mélange de `melange.ts`) par défaut, comme l'accueil (2026-11-06).
  const tri = ["recent", "populaire"].includes(premier(brut.tri) ?? "") ? premier(brut.tri)! : "pour-vous";

  const categories = await categoriesEnCache();

  const categorieParam = premier(brut.categorie);
  const categorie = categories.some((c) => c.name === categorieParam) ? categorieParam! : "Tout";
  /* Plus de filtre de ville (décision du 2026-10-22) : la recherche couvre
     toute la Guinée, la ville de chaque boutique s'affiche sur sa carte.
     Un ancien lien `?ville=…` est simplement ignoré. */
  const category = categorie !== "Tout" ? categories.find((c) => c.name === categorie) : undefined;
  const sort = tri === "populaire" ? "popular" : "recent";

  // Les filtres de la mode (2026-11-10), chacun relu contre sa liste.
  const genre = GENRES_FILTRE.find((g) => g.valeur === premier(brut.genre))?.valeur ?? "";
  /* Les tailles qui ont un sens pour ce choix : celles de la catégorie et
     du genre choisis ; sans catégorie, vêtements puis pointures. */
  const taillesProposees = category
    ? aPlat(groupesDeTailles(category.famille, genre, category.slug))
    : aPlat([...groupesDeTailles("vetements", genre, "pantalons"), ...groupesDeTailles("chaussures", genre)]);
  const taille = taillesProposees.find((t) => t === premier(brut.taille)) ?? "";
  const couleur = NOMS_COULEURS.find((c) => c === premier(brut.couleur)) ?? "";
  const tranche = lireTranchePrix(premier(brut.prix));

  const trouves = await rechercheEnCache({
    query: q,
    categoryId: category?.id ?? null,
    genre: genre || null,
    taille: taille || null,
    couleur: couleur || null,
    prixMin: tranche?.min ?? null,
    prixMax: tranche?.max ?? null,
    sort,
    limit: 50,
  });
  const results = tri === "pour-vous" ? melanger(trouves, await goutsDeLaRequete()) : trouves;

  const filtresMode = [genre, taille, couleur, tranche?.valeur].filter(Boolean).length;

  /* Au plus deux produits sponsorisés, PERTINENTS pour cette recherche ou
     cette catégorie (0047), en tête et marqués. Rien sur l'écran de repos.
     Pas de publicité quand un filtre de mode est posé : la campagne ne
     connaît ni la taille ni la couleur, elle afficherait un produit qui ne
     correspond pas à ce qui est demandé. */
  const sponsorises =
    (q || category) && filtresMode === 0
      ? await produitsSponsorises({ query: q, categoryId: category?.id ?? null, limit: 2 })
      : [];
  await compterAffichages(sponsorises.map((p) => p.campagneId));
  const idsSponsorises = new Set(sponsorises.map((p) => p.id));

  if (q || category || filtresMode > 0) {
    await compter("recherche", {
      query: q || null,
      categoryId: category?.id ?? null,
      resultCount: results.length,
    });
  }

  const activeFilterCount = (categorie !== "Tout" ? 1 : 0) + filtresMode;
  const resting = !q && categorie === "Tout" && filtresMode === 0;

  const clearFiltersHref = `/recherche?q=${encodeURIComponent(q)}`;

  const courant = { q, genre, categorie, taille, couleur, prix: tranche?.valeur ?? "", tri };
  const lien = (modifs: Partial<typeof courant>) => {
    const suivant = { ...courant, ...modifs };
    // Changer de catégorie peut changer de rayon : une pointure ne vaut pas pour une robe.
    if (modifs.categorie !== undefined && modifs.categorie !== categorie && modifs.taille === undefined) {
      suivant.taille = "";
    }
    const params = new URLSearchParams();
    for (const [cle, valeur] of Object.entries(suivant)) {
      if (cle === "q" || (valeur && valeur !== "Tout")) params.set(cle, valeur);
    }
    return `/recherche?${params.toString()}`;
  };

  return (
    <TabScreen largeur="grille">
      <TopBar
        title={
          <form action="/recherche" method="get" className="flex h-tap flex-1 items-center gap-2.5 rounded-lg border border-line bg-surface px-3.5">
            {Object.entries({ genre, categorie, taille, couleur, prix: tranche?.valeur ?? "", tri }).map(([cle, valeur]) =>
              valeur && valeur !== "Tout" ? <input key={cle} type="hidden" name={cle} value={valeur} /> : null,
            )}
            <button type="submit" aria-label="Lancer la recherche" className="shrink-0 text-ink-soft">
              <Search size={18} strokeWidth={1.8} aria-hidden />
            </button>
            <input
              type="search"
              name="q"
              defaultValue={q}
              enterKeyHint="search"
              autoComplete="off"
              placeholder="Robe, baskets, sac…"
              aria-label="Rechercher un vêtement ou un accessoire"
              className="h-full min-w-0 flex-1 bg-transparent text-base font-medium outline-none placeholder:font-normal placeholder:text-ink-faint"
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
            <SectionLabel>Pour qui</SectionLabel>
            <GenreTiles />
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
                title="Pour qui"
                label={libelleGenre(genre) ?? "Pour qui"}
                selected={genre !== ""}
                icon={User}
                options={[
                  { label: "Tout le monde", href: lien({ genre: "" }), selected: genre === "" },
                  ...GENRES_FILTRE.map((g) => ({
                    label: g.libelle,
                    href: lien({ genre: g.valeur }),
                    selected: g.valeur === genre,
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
                title="Taille"
                label={taille || "Taille"}
                selected={taille !== ""}
                icon={Ruler}
                options={[
                  { label: "Toutes tailles", href: lien({ taille: "" }), selected: taille === "" },
                  ...taillesProposees.map((t) => ({ label: t, href: lien({ taille: t }), selected: t === taille })),
                ]}
              />
              <FilterChip
                title="Couleur"
                label={couleur || "Couleur"}
                selected={couleur !== ""}
                icon={Palette}
                options={[
                  { label: "Toutes couleurs", href: lien({ couleur: "" }), selected: couleur === "" },
                  ...COULEURS.map((c) => ({ label: c.nom, href: lien({ couleur: c.nom }), selected: c.nom === couleur })),
                ]}
              />
              <FilterChip
                title="Prix"
                label={tranche?.libelle ?? "Prix"}
                selected={tranche !== null}
                icon={Banknote}
                options={[
                  { label: "Tous les prix", href: lien({ prix: "" }), selected: tranche === null },
                  ...TRANCHES_PRIX.map((t) => ({
                    label: t.libelle,
                    href: lien({ prix: t.valeur }),
                    selected: t.valeur === tranche?.valeur,
                  })),
                ]}
              />
              <FilterChip
                title="Trier par"
                label={tri === "populaire" ? "Populaires" : tri === "recent" ? "Récents" : "Pour vous"}
                icon={ArrowUpDown}
                options={[
                  { label: "Pour vous", href: lien({ tri: "pour-vous" }), selected: tri === "pour-vous" },
                  { label: "Récents", href: lien({ tri: "recent" }), selected: tri === "recent" },
                  { label: "Populaires", href: lien({ tri: "populaire" }), selected: tri === "populaire" },
                ]}
              />
            </ChipRow>

            {results.length === 0 ? (
              <EmptyState
                icon={Search}
                title={q ? `Aucun résultat pour « ${q} »` : "Aucun article ici"}
                description="Essayez un mot plus court, ou retirez un filtre (taille, couleur, prix)."
              >
                <Button variant="secondary" href={clearFiltersHref}>
                  Effacer les filtres
                </Button>
              </EmptyState>
            ) : (
              <ProductGrid>
                {sponsorises.map((p, i) => (
                  <ProductCard
                    key={`pub-${p.id}`}
                    product={p}
                    sponsorise={{ campagneId: p.campagneId }}
                    prioritaire={i < CARTES_PRIORITAIRES}
                  />
                ))}
                {results
                  .filter((p) => !idsSponsorises.has(p.id))
                  .map((p, i) => (
                    <ProductCard key={p.id} product={p} prioritaire={sponsorises.length + i < CARTES_PRIORITAIRES} />
                  ))}
              </ProductGrid>
            )}
          </Section>
        )}
      </ScreenBody>
    </TabScreen>
  );
}
