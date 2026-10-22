import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Chip, ChipRow } from "@/components/ui/Chip";
import { ScreenBody, Section, TabScreen } from "@/components/ui/Screen";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { TopBar, Wordmark } from "@/components/ui/TopBar";
import { ProductCard } from "@/components/product/ProductCard";
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
import { landingForSession } from "@/lib/data/session";
import { categoriesEnCache, rechercheEnCache } from "@/lib/data/catalogue-public";
import { compter } from "@/lib/analytics";
import { premier } from "@/lib/next-param";

/** L'accueil filtré (`?categorie=…`) n'est qu'une variante de l'accueil. */
export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
  const filtree = Object.keys(await searchParams).length > 0;
  return {
    alternates: { canonical: "/" },
    robots: filtree ? { index: false, follow: true } : undefined,
  };
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ categorie?: string | string[]; tri?: string | string[] }>;
}) {
  // Même lecture prudente que `/recherche` : un paramètre peut être répété.
  const brut = await searchParams;
  const categorie = premier(brut.categorie) ?? "Tout";
  const tri = premier(brut.tri) ?? "recent";
  const supabase = await createClient();

  const landing = await landingForSession(supabase);
  if (landing !== "/") redirect(landing);

  /* Toute la Guinée, sans filtre de ville (décision du 2026-10-22) : un
     client de Conakry voit aussi ce qui se vend à Koya. Seule la boutique
     porte une ville, affichée sur chaque carte. Un ancien lien
     `?ville=…` est simplement ignoré. */
  const categories = await categoriesEnCache();

  const sort = tri === "populaire" ? "popular" : "recent";
  const tous = await rechercheEnCache({ sort, limit: 50 });
  const visible = categorie === "Tout" ? tous : tous.filter((p) => p.category === categorie);
  const featuredHere = visible.find((p) => p.isFeatured) ?? null;

  const triHref = (valeur: string) =>
    `/?categorie=${encodeURIComponent(categorie)}&tri=${valeur}`;
  const gridItems = featuredHere ? visible.filter((p) => p.id !== featuredHere.id) : visible;

  compter("visite", {});

  return (
    <TabScreen largeur="grille">
      <TopBar title={<Wordmark size="lg" />} />

      <ScreenBody>
        <Section className="gap-3 pb-1">
          <ChipRow>
            <Link href="/?categorie=Tout">
              <Chip selected={categorie === "Tout"}>Tout</Chip>
            </Link>
            {categories.map((c) => (
              <Link
                key={c.id}
                href={`/?categorie=${encodeURIComponent(c.name)}`}
              >
                <Chip selected={c.name === categorie}>{c.name}</Chip>
              </Link>
            ))}
          </ChipRow>
        </Section>

        {visible.length === 0 && categorie !== "Tout" && tous.length > 0 ? (
          <EmptyState
            icon={Package}
            title={`Aucun produit « ${categorie} » pour le moment`}
            description="Essayez une autre catégorie, ou regardez tout ce qui est en vente."
          >
            <Button href="/">Voir toutes les catégories</Button>
          </EmptyState>
        ) : visible.length === 0 ? (
          <EmptyState
            icon={Package}
            title="Aucun produit pour le moment"
            description="Inscrivez-vous comme vendeur pour être le premier à publier."
          >
            <Button variant="secondary" href="/inscription">
              Devenir vendeur
            </Button>
          </EmptyState>
        ) : (
          <>
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
          <div className="flex items-baseline justify-between">
            {sort === "popular" ? (
              <Link href={triHref("recent")} className="text-sm font-semibold text-accent">
                Récents
              </Link>
            ) : (
              <SectionLabel>Récents</SectionLabel>
            )}
            {sort === "popular" ? (
              <SectionLabel>Populaires</SectionLabel>
            ) : (
              <Link href={triHref("populaire")} className="text-sm font-semibold text-accent">
                Populaires
              </Link>
            )}
          </div>
          <ProductGrid>
            {gridItems.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </ProductGrid>
        </Section>
          </>
        )}
      </ScreenBody>
    </TabScreen>
  );
}
