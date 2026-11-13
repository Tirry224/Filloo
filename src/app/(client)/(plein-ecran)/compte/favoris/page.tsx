import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Card } from "@/components/ui/Card";
import { Screen, ScreenBody, Section } from "@/components/ui/Screen";
import { TopBar } from "@/components/ui/TopBar";
import { ProductCard } from "@/components/product/ProductCard";
import { ProductGrid } from "@/components/product/ProductGrid";
import { createClient } from "@/lib/supabase/server";
import { clientSpaceFallback, getMyProfile } from "@/lib/data/session";
import { getMesFavoris, getMesProduitsFavoris } from "@/lib/data/favoris";
import { cn } from "@/lib/cn";

/**
 * « Mes favoris » : deux onglets, Boutiques et Produits (cœurs de la page
 * boutique et de la fiche produit). Un appui ouvre la boutique ou le
 * produit ; on retire un favori là où est son cœur. L'onglet vit dans
 * l'adresse (`?onglet=produits`) : le retour arrière y ramène.
 */
export default async function FavorisPage({ searchParams }: { searchParams: Promise<{ onglet?: string }> }) {
  const { onglet: demande } = await searchParams;
  const onglet = demande === "produits" ? "produits" : "boutiques";

  const supabase = await createClient();
  const client = await getMyProfile(supabase, "client");
  if (!client) redirect(await clientSpaceFallback(supabase));

  const [boutiques, produits] = await Promise.all([
    getMesFavoris(supabase, client.id),
    getMesProduitsFavoris(supabase, client.id),
  ]);

  return (
    <Screen largeur={onglet === "produits" ? "grille" : "colonne"}>
      <TopBar title="Mes favoris" backHref="/compte" />
      <ScreenBody>
        <Section className="gap-4">
          <nav aria-label="Favoris" className="inline-flex self-start rounded-full border border-line bg-surface p-1">
            {(
              [
                ["boutiques", `Boutiques · ${boutiques.length}`],
                ["produits", `Produits · ${produits.length}`],
              ] as const
            ).map(([cle, libelle]) => (
              <Link
                key={cle}
                href={`/compte/favoris?onglet=${cle}`}
                replace
                scroll={false}
                aria-current={onglet === cle ? "page" : undefined}
                className={cn(
                  "rounded-full px-3.5 py-1.5 text-sm font-semibold",
                  onglet === cle ? "bg-accent text-on-accent" : "text-ink-soft",
                )}
              >
                {libelle}
              </Link>
            ))}
          </nav>

          {onglet === "boutiques" ? (
            boutiques.length === 0 ? (
              <p className="text-sm text-ink-soft">
                Aucune boutique favorite. Touchez le cœur en haut d&apos;une boutique pour la retrouver ici.
              </p>
            ) : (
              <Card className="px-3.5">
                {boutiques.map((b) => (
                  <Link
                    key={b.id}
                    href={`/boutique/${b.id}`}
                    className="flex items-center gap-3.5 border-b border-line py-3 last:border-b-0"
                  >
                    <Avatar name={b.shopName} kind="shop" size={44} src={b.photoUrl} />
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="truncate text-base font-semibold">{b.shopName}</span>
                      <span className="truncate text-sm text-ink-soft">{b.city}</span>
                    </span>
                    <ChevronRight size={18} strokeWidth={2} aria-hidden className="shrink-0 text-ink-soft" />
                  </Link>
                ))}
              </Card>
            )
          ) : produits.length === 0 ? (
            <p className="text-sm text-ink-soft">
              Aucun produit favori. Touchez le cœur sur la photo d&apos;un produit pour le retrouver ici.
            </p>
          ) : (
            <ProductGrid>
              {produits.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </ProductGrid>
          )}
        </Section>
      </ScreenBody>
    </Screen>
  );
}
