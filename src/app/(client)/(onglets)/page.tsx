import type { Metadata } from "next";
import { redirect } from "next/navigation";
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
import { FiltresAccueil, lireRayon } from "@/components/product/FiltresAccueil";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getMyProfiles, landingForSession } from "@/lib/data/session";
import { PushBell } from "@/components/push/PushBell";
import { categoriesEnCache, rechercheEnCache } from "@/lib/data/catalogue-public";
import { compter } from "@/lib/analytics";
import { premier } from "@/lib/next-param";
import { estFiltree, IMAGE_APERCU_FILLOO, jsonLd } from "@/lib/seo";
import { siteUrl } from "@/lib/site-url";
import { goutsDeLaRequete } from "@/lib/data/gouts-serveur";
import { melanger } from "@/lib/melange";
import { BoutiquesADecouvrir } from "@/components/product/BoutiquesADecouvrir";
import { GENRES_FILTRE } from "@/lib/mode";
import { boutiquesMisesEnAvant, compterAffichages, produitsSponsorises } from "@/lib/data/publicite";

/*
 * L'accueil condensé (demande du porteur du projet, 2026-11-10 : « très
 * très facile à utiliser et à comprendre ») : deux choix seulement, POUR
 * QUI (une barre) et QUEL RAYON (trois tuiles). Les 16 catégories, la
 * taille, la couleur, le prix et le tri sont dans Recherche, où on va
 * quand on sait ce qu'on cherche. Ordre « Pour vous » (le mélange) fixe ;
 * un ancien lien `?tri=` ou `?categorie=` est simplement ignoré. Les deux
 * choix sont dans `FiltresAccueil`.
 */

/** L'accueil filtré (`?categorie=…`, `?tri=…`) n'est qu'une variante de
 * l'accueil ; un paramètre de suivi (`?fbclid=…`) n'en fait pas une. */
export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
  const filtree = estFiltree(await searchParams, ["genre", "rayon"]);
  return {
    alternates: { canonical: "/" },
    /* `og:url` et `og:type` : sans eux, WhatsApp et Facebook devinent
       l'adresse et le genre de la page (audit SEO du 2026-11-12). Le titre
       et la description viennent du layout ; l'IMAGE, non : un `openGraph`
       de page remplace celui du layout en entier, y compris l'image de
       `opengraph-image.tsx` (constaté au build). D'où sa reprise ici. */
    openGraph: {
      type: "website",
      url: "/",
      siteName: "Filloo",
      images: [IMAGE_APERCU_FILLOO],
    },
    robots: filtree ? { index: false, follow: true } : undefined,
  };
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ genre?: string | string[]; rayon?: string | string[] }>;
}) {
  // Même lecture prudente que `/recherche` : un paramètre peut être répété.
  const brut = await searchParams;
  // Une valeur inconnue est ignorée, jamais affichée comme un filtre actif.
  const genre = GENRES_FILTRE.find((g) => g.valeur === premier(brut.genre))?.valeur ?? "";
  const rayon = lireRayon(premier(brut.rayon));
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
  // Le rayon d'un produit se lit par sa catégorie (les cartes ne portent que son nom).
  const categories = await categoriesEnCache();
  const rayonDe = new Map(categories.map((c) => [c.name, c.famille]));

  const tous = await rechercheEnCache({ sort: "recent", genre: genre || null, limit: 50 });
  const filtres = rayon ? tous.filter((p) => rayonDe.get(p.category) === rayon) : tous;
  /* Le mélange se fait APRÈS le cache, à chaque affichage : la liste
     partagée reste lue une fois par minute, l'ordre change à chaque visite. */
  const visible = melanger(filtres, gouts);

  /* La publicité (0047) : au plus deux produits sponsorisés, et les
     boutiques mises en avant, sur l'accueil NON filtré seulement : une
     campagne ne connaît ni le genre ni le rayon, elle afficherait un
     article qui ne correspond pas au choix. */
  const filtre = Boolean(genre || rayon);
  const [sponsorises, boutiquesEnAvant] = await Promise.all([
    filtre ? Promise.resolve([]) : produitsSponsorises({ categoryId: null, limit: 2 }),
    filtre ? Promise.resolve([]) : boutiquesMisesEnAvant(),
  ]);
  await compterAffichages([...sponsorises, ...boutiquesEnAvant].map((x) => x.campagneId));
  const idsSponsorises = new Set(sponsorises.map((p) => p.id));
  const featuredHere = visible.find((p) => p.isFeatured) ?? null;

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
      {/* Le seul `<h1>` de l'accueil : le logo, complété pour les moteurs
          et les lecteurs d'écran de ce que le site vend et où. */}
      <TopBar
        title={
          <h1>
            <Wordmark size="lg" />
            <span className="sr-only"> — vêtements, chaussures et accessoires en Guinée</span>
          </h1>
        }
        right={<PushBell connecte={connecte} />}
      />

      <ScreenBody>
        <FiltresAccueil genre={genre} rayon={rayon} />

        {visible.length === 0 && filtre ? (
          <EmptyState
            icon={Package}
            title="Aucun article ici pour le moment"
            description="Essayez un autre choix, ou regardez tout ce qui est en vente."
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
          <SectionLabel>Pour vous</SectionLabel>
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

        {/* Le pied de page de l'accueil : le site n'en a pas d'autre (la
            barre d'onglets en tient lieu), et un visiteur sans compte n'a
            pas accès au menu « Compte » où vivent ces liens. */}
        <footer className="mt-auto flex flex-wrap justify-center gap-x-4 gap-y-1 px-4 pt-6 pb-4 text-sm text-ink-soft">
          <Link href="/aide" className="font-semibold text-accent underline">
            Comment ça marche
          </Link>
          <Link href="/conditions" className="underline">
            Conditions
          </Link>
          <Link href="/contact" className="underline">
            Contact
          </Link>
        </footer>
      </ScreenBody>
    </TabScreen>
  );
}
