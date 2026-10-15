import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MapPin } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Card } from "@/components/ui/Card";
import { ScreenBody, Section, TabScreen } from "@/components/ui/Screen";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { TopBar } from "@/components/ui/TopBar";
import { ProductCard } from "@/components/product/ProductCard";
import { ProductGrid } from "@/components/product/ProductGrid";
import { createClient } from "@/lib/supabase/server";
import { getMerchant, getMerchantProducts, getMyMerchant } from "@/lib/data/merchants";
import { boutiqueEnCache, produitsBoutiqueEnCache } from "@/lib/data/catalogue-public";
import { compter } from "@/lib/analytics";

/**
 * La boutique telle que le public la voit, depuis le cache partagé ;
 * sinon telle que CETTE session la voit (une boutique qui vient d'ouvrir,
 * ou celle d'un interlocuteur que le RLS laisse lire).
 */
async function boutiqueVisible(id: string) {
  return (await boutiqueEnCache(id)) ?? getMerchant(await createClient(), id);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const merchant = await boutiqueVisible(id);

  if (!merchant) {
    return { title: "Boutique introuvable", robots: { index: false, follow: false } };
  }

  const titre = `${merchant.shopName} — ${merchant.city}`;
  const description =
    merchant.description?.slice(0, 200) ||
    `Découvrez les produits de ${merchant.shopName}, à ${merchant.city}, et contactez le commerçant sur Filloo.`;

  return {
    title: titre,
    description,
    openGraph: { type: "website", title: titre, description },
  };
}

export default async function ShopPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const merchant = await boutiqueVisible(id);
  if (!merchant) notFound();

  /* Le propriétaire voit aussi ses brouillons et produits masqués : pas
     depuis le cache public. Un visiteur sans compte ne touche pas la base
     ici (`getMyMerchant` ne lit rien sans session). */
  const supabase = await createClient();
  const proprietaire = (await getMyMerchant(supabase))?.id === merchant.id;
  const catalogue = proprietaire
    ? await getMerchantProducts(supabase, merchant)
    : await produitsBoutiqueEnCache(merchant);

  compter("boutique_vue", { merchantId: merchant.id });

  return (
    <TabScreen largeur="grille">
      <TopBar title={merchant.shopName} backHref="/" />

      <ScreenBody>
        <Section className="gap-4">
          <div className="flex items-center gap-3.5">
            <Avatar name={merchant.shopName} kind="shop" size={64} src={merchant.photoUrl} />
            <div className="flex flex-col gap-1">
              <h2 className="text-xl font-bold">{merchant.shopName}</h2>
              <p className="text-sm text-ink-soft">{merchant.description}</p>
            </div>
          </div>

          <Card className="flex flex-col gap-2 p-3.5">
            <p className="flex items-center gap-2.5 text-sm">
              <MapPin size={17} strokeWidth={1.8} className="shrink-0 text-ink-soft" aria-hidden />
              {merchant.addressHint} · {merchant.city}
            </p>
          </Card>

          <SectionLabel>
            {catalogue.length} produit{catalogue.length > 1 ? "s" : ""} en vente
          </SectionLabel>
          <ProductGrid>
            {catalogue.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </ProductGrid>
        </Section>
      </ScreenBody>
    </TabScreen>
  );
}
