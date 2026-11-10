import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Chip, ChipRow } from "@/components/ui/Chip";
import { ScreenBody, Section, TabScreen } from "@/components/ui/Screen";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { TopBar, Wordmark } from "@/components/ui/TopBar";
import { CARTES_PRIORITAIRES, ProductCard } from "@/components/product/ProductCard";
import { ProductGrid } from "@/components/product/ProductGrid";
import { Card } from "@/components/ui/Card";
import { Photo } from "@/components/ui/Photo";
import { Badge } from "@/components/ui/Badge";
import { PriceTag } from "@/components/product/PriceTag";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { Package } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getMyProfiles, landingForSession } from "@/lib/data/session";
import { PushBell } from "@/components/push/PushBell";
import { categoriesEnCache, rechercheEnCache } from "@/lib/data/catalogue-public";
import { compter } from "@/lib/analytics";
import { premier } from "@/lib/next-param";
import { estFiltree, jsonLd } from "@/lib/seo";
import { siteUrl } from "@/lib/site-url";
import { goutsDeLaRequete } from "@/lib/data/gouts-serveur";
import { categoriesParGouts, melanger } from "@/lib/melange";
import { RetenirGout } from "@/components/product/RetenirGout";
import { BoutiquesADecouvrir } from "@/components/product/BoutiquesADecouvrir";
import { GENRES_FILTRE } from "@/lib/mode";
import { boutiquesMisesEnAvant, compterAffichages, produitsSponsorises } from "@/lib/data/publicite";

/** Les trois ordres de l'accueil. « Pour vous », le mélange, est celui par défaut (2026-11-06). */
const TRIS = [
  { valeur: "pour-vous", libelle: "Pour vous" },
  { valeur: "recent", libelle: "Récents" },
  { valeur: "populaire", libelle: "Populaires" },
] as const;

/** L'accueil filtré (`?categorie=…`, `?tri=…`) n'est qu'une variante de
 * l'accueil ; un paramètre de suivi (`?fbclid=…`) n'en fait pas une. */
export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
  const filtree = estFiltree(await searchParams, ["genre", "categorie", "tri"]);
  return {
    alternates: { canonical: "/" },
    robots: filtree ? { index: false, follow: true } : undefined,
  };
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ genre?: string | string[]; categorie?: string | string[]; tri?: string | string[] }>;
}) {
  // Même lecture prudente que `/recherche` : un paramètre peut être répété.
  const brut = await searchParams;
  const categorie = premier(brut.categorie) ?? "Tout";
  // Femme, Homme, Enfant (2026-11-10) ; une valeur inconnue est ignorée.
  const genre = GENRES_FILTRE.find((g) => g.valeur === premier(brut.genre))?.valeur ?? "";
  const tri = TRIS.find((t) => t.valeur === premier(brut.tri))?.valeur ?? "pour-vous";
  const supabase = await createClient();

  const landing = await landingForSession(supabase);
  // Lecture en cache (`getMyProfiles`) : déjà faite par `landingForSession`.
  const connecte = (await getMyProfiles(supabase)).some((p) => !p.isDeleted);
  if (landing !== "/") redirect(landing);

  /* Toute la Guinée, sans filtre de ville (décision du 2026-10-22) : un
     client de Conakry voit aussi ce qui se vend à Koya. Seule la boutique
     porte une ville, affichée sur chaque carte. Un ancien lien
     `?ville=…` est simplement ignoré. */
  const gouts = await goutsDeLaRequete();
  // Les catégories regardées souvent viennent d'abord ; l'ordre des autres ne bouge pas, pour s'y retrouver.
  const categories = categoriesParGouts(await categoriesEnCache(), gouts);

  const sort = tri === "populaire" ? "popular" : "recent";
  const tous = await rechercheEnCache({ sort, genre: genre || null, limit: 50 });
  const filtres = categorie === "Tout" ? tous : tous.filter((p) => p.category === categorie);
  /* Le mélange se fait APRÈS le cache, à chaque affichage : la liste
     partagée reste lue une fois par minute, l'ordre change à chaque visite. */
  const visible = tri === "pour-vous" ? melanger(filtres, gouts) : filtres;

  /* La publicité (0047) : au plus deux produits sponsorisés de cet
     emplacement, et les boutiques mises en avant sur l'accueil complet. */
  const idCategorie = categories.find((c) => c.name === categorie)?.id ?? null;
  // Une campagne ne connaît pas le genre : pas de publicité sur un accueil filtré par genre.
  const [sponsorises, boutiquesEnAvant] = await Promise.all([
    genre ? Promise.resolve([]) : produitsSponsorises({ categoryId: idCategorie, limit: 2 }),
    categorie === "Tout" && !genre ? boutiquesMisesEnAvant() : Promise.resolve([]),
  ]);
  await compterAffichages([...sponsorises, ...boutiquesEnAvant].map((x) => x.campagneId));
  const idsSponsorises = new Set(sponsorises.map((p) => p.id));
  const featuredHere = visible.find((p) => p.isFeatured) ?? null;

  /** L'adresse de l'accueil avec un filtre changé, les autres gardés. */
  const accueil = (modifs: { genre?: string; categorie?: string; tri?: string }) => {
    const suivant = { genre, categorie, tri, ...modifs };
    const params = new URLSearchParams();
    if (suivant.genre) params.set("genre", suivant.genre);
    params.set("categorie", suivant.categorie);
    if (suivant.tri !== "pour-vous") params.set("tri", suivant.tri);
    return `/?${params.toString()}`;
  };
  const triHref = (valeur: string) => accueil({ tri: valeur });
  // Un produit sponsorisé n'apparaît pas une seconde fois plus bas.
  const ordinaires = (featuredHere ? visible.filter((p) => p.id !== featuredHere.id) : visible).filter(
    (p) => !idsSponsorises.has(p.id),
  );
  /* Le premier en tête, le second après quatre produits ordinaires : visibles
     sans former un bloc d'annonces. */
  const gridItems = [
    ...sponsorises.slice(0, 1).map((p) => ({ p, s: p.campagneId })),
    ...ordinaires.slice(0, 4).map((p) => ({ p, s: null })),
    ...sponsorises.slice(1).map((p) => ({ p, s: p.campagneId })),
    ...ordinaires.slice(4).map((p) => ({ p, s: null })),
  ];

  await compter("visite", {});

  /* Ce que Google lit pour nommer le site dans ses résultats (« Filloo »
     plutôt que « filloo.net ») et le relier à une organisation. Seulement
     sur l'accueil, comme le demande sa documentation. */
  const base = siteUrl();
  const donneesStructurees = base
    ? jsonLd([
        {
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: "Filloo",
          alternateName: "filloo.net",
          url: `${base}/`,
          inLanguage: "fr",
        },
        {
          "@context": "https://schema.org",
          "@type": "Organization",
          name: "Filloo",
          url: `${base}/`,
          logo: `${base}/icons/icone-512.png`,
          areaServed: { "@type": "Country", name: "Guinée" },
        },
      ])
    : null;

  return (
    <TabScreen largeur="grille">
      {donneesStructurees ? (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: donneesStructurees }} />
      ) : null}
      {/* La cloche prend la place de l'ancienne puce de ville. */}
      <TopBar title={<Wordmark size="lg" />} right={<PushBell connecte={connecte} />} />

      <ScreenBody>
        {categorie !== "Tout" ? <RetenirGout categorie={categorie} /> : null}
        <Section className="gap-3 pb-1">
          <ChipRow>
            <Link href={accueil({ genre: "" })}>
              <Chip selected={genre === ""}>Tout le monde</Chip>
            </Link>
            {GENRES_FILTRE.map((g) => (
              <Link key={g.valeur} href={accueil({ genre: g.valeur })}>
                <Chip selected={g.valeur === genre}>{g.libelle}</Chip>
              </Link>
            ))}
          </ChipRow>
          <ChipRow>
            <Link href={accueil({ categorie: "Tout" })}>
              <Chip selected={categorie === "Tout"}>Tout</Chip>
            </Link>
            {categories.map((c) => (
              <Link key={c.id} href={accueil({ categorie: c.name })}>
                <Chip selected={c.name === categorie}>{c.name}</Chip>
              </Link>
            ))}
          </ChipRow>
        </Section>

        {visible.length === 0 && (categorie !== "Tout" || genre) ? (
          <EmptyState
            icon={Package}
            title={categorie !== "Tout" ? `Aucun article « ${categorie} » pour le moment` : "Aucun article pour le moment"}
            description="Essayez une autre catégorie, ou regardez tout ce qui est en vente."
          >
            <Button href="/">Voir tous les articles</Button>
          </EmptyState>
        ) : visible.length === 0 ? (
          <EmptyState
            icon={Package}
            title="Aucun article pour le moment"
            description="Vous vendez des vêtements, des chaussures ou des accessoires ? Ouvrez votre boutique et publiez les premiers."
          >
            <Button variant="secondary" href="/inscription">
              Devenir vendeur
            </Button>
          </EmptyState>
        ) : (
          <>
        <BoutiquesADecouvrir boutiques={boutiquesEnAvant} />
        {featuredHere ? (
          <Section className="gap-2 pt-2 pb-0">
            <SectionLabel>À la une</SectionLabel>
            <Link href={`/produit/${featuredHere.id}`}>
              <Card className="flex">
                <Photo ratio="free" className="w-26 shrink-0" />
                <div className="flex flex-col justify-center gap-1 px-3 py-3">
                  <h3 className="text-base font-semibold">{featuredHere.title}</h3>
                  <PriceTag amount={featuredHere.priceGnf} size="md" />
                  <p className="text-2xs text-ink-soft">
                    {featuredHere.merchant.shopName} · {featuredHere.merchant.city}
                  </p>
                  {featuredHere.isNegotiable ? (
                    <Badge tone="accent" className="self-start">
                      Négociable
                    </Badge>
                  ) : null}
                </div>
              </Card>
            </Link>
          </Section>
        ) : null}

        <Section className="gap-2 pt-3.5">
          <div className="flex items-baseline gap-4">
            {TRIS.map((t) =>
              t.valeur === tri ? (
                <SectionLabel key={t.valeur}>{t.libelle}</SectionLabel>
              ) : (
                <Link key={t.valeur} href={triHref(t.valeur)} className="text-sm font-semibold text-accent">
                  {t.libelle}
                </Link>
              ),
            )}
          </div>
          <ProductGrid>
            {gridItems.map(({ p, s }, i) => (
              <ProductCard
                key={p.id}
                product={p}
                sponsorise={s ? { campagneId: s } : undefined}
                prioritaire={i < CARTES_PRIORITAIRES}
              />
            ))}
          </ProductGrid>
        </Section>
          </>
        )}
      </ScreenBody>
    </TabScreen>
  );
}
