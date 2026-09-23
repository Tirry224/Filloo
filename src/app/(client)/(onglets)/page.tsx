import { redirect } from "next/navigation";
import { MapPin } from "lucide-react";
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
import { FALLBACK_CITY, getCategories, getCities, getDefaultCityName } from "@/lib/data/reference";
import { landingForSession } from "@/lib/data/session";
import { searchProducts } from "@/lib/data/products";
import { compter } from "@/lib/analytics";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ ville?: string; categorie?: string; tri?: string }>;
}) {
  const { ville: villeParam, categorie = "Tout", tri = "recent" } = await searchParams;
  const supabase = await createClient();

  const landing = await landingForSession(supabase);
  if (landing !== "/") redirect(landing);

  const [cities, categories] = await Promise.all([getCities(supabase), getCategories(supabase)]);
  const ville = villeParam ?? (await getDefaultCityName(supabase, cities));
  const city = cities.find((c) => c.name === ville) ?? cities.find((c) => c.name === FALLBACK_CITY);

  const sort = tri === "populaire" ? "popular" : "recent";
  const inCity = city ? await searchProducts(supabase, { cityId: city.id, sort, limit: 50 }) : [];
  const visible = categorie === "Tout" ? inCity : inCity.filter((p) => p.category === categorie);
  const featuredHere = visible.find((p) => p.isFeatured) ?? null;

  const triHref = (valeur: string) =>
    `/?ville=${encodeURIComponent(ville)}&categorie=${encodeURIComponent(categorie)}&tri=${valeur}`;
  const gridItems = featuredHere ? visible.filter((p) => p.id !== featuredHere.id) : visible;

  compter("visite", { cityId: city?.id ?? null });

  return (
    <TabScreen largeur="grille">
      <TopBar
        title={<Wordmark size="lg" />}
        right={<Chip icon={MapPin}>{ville}</Chip>}
      />

      <ScreenBody>
        <Section className="gap-3 pb-1">
          <ChipRow>
            <Link href={`/?ville=${encodeURIComponent(ville)}&categorie=Tout`}>
              <Chip selected={categorie === "Tout"}>Tout</Chip>
            </Link>
            {categories.map((c) => (
              <Link
                key={c.id}
                href={`/?ville=${encodeURIComponent(ville)}&categorie=${encodeURIComponent(c.name)}`}
              >
                <Chip selected={c.name === categorie}>{c.name}</Chip>
              </Link>
            ))}
          </ChipRow>
        </Section>

        {visible.length === 0 && categorie !== "Tout" && inCity.length > 0 ? (
          <EmptyState
            icon={Package}
            title={`Aucun produit « ${categorie} » à ${ville}`}
            description="Essayez une autre catégorie, ou regardez tout ce qui est en vente dans cette ville."
          >
            <Button href={`/?ville=${encodeURIComponent(ville)}`}>Voir toutes les catégories</Button>
          </EmptyState>
        ) : visible.length === 0 ? (
          <EmptyState
            icon={Package}
            title={`Aucun produit à ${ville} pour le moment`}
            description="Filloo démarre à Conakry. Changez de ville pour voir ce qui est en vente, ou inscrivez-vous comme vendeur pour être le premier ici."
          >
            {ville !== FALLBACK_CITY ? (
              <Button href={`/?ville=${encodeURIComponent(FALLBACK_CITY)}`}>
                Voir les produits à {FALLBACK_CITY}
              </Button>
            ) : null}
            <Button variant="secondary" href="/inscription">
              Devenir vendeur à {ville}
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
