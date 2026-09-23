import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Check, MapPin } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Card } from "@/components/ui/Card";
import { ScreenBody, Section } from "@/components/ui/Screen";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { TopBar } from "@/components/ui/TopBar";
import { ProductCard } from "@/components/product/ProductCard";
import { createClient } from "@/lib/supabase/server";
import { getMerchant, getMerchantProducts } from "@/lib/data/merchants";
import { compter } from "@/lib/analytics";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  const merchant = await getMerchant(supabase, id);

  if (!merchant) {
    return { title: "Boutique introuvable", robots: { index: false, follow: false } };
  }

  const titre = `${merchant.shopName} — ${merchant.city}`;
  const description =
    merchant.description?.slice(0, 200) ||
    `Découvrez les produits de ${merchant.shopName}, à ${merchant.city}, et contactez le commerçant sur Makiti.`;

  return {
    title: titre,
    description,
    openGraph: { type: "website", title: titre, description },
  };
}

export default async function ShopPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const merchant = await getMerchant(supabase, id);
  if (!merchant) notFound();

  const catalogue = await getMerchantProducts(supabase, merchant);

  compter("boutique_vue", { merchantId: merchant.id });

  return (
    <>
      <TopBar title={merchant.shopName} backHref="/" />

      <ScreenBody>
        <Section className="gap-4">
          <div className="flex items-center gap-3.5">
            <Avatar name={merchant.shopName} kind="shop" size={64} />
            <div className="flex flex-col gap-1">
              <h2 className="text-xl font-bold">{merchant.shopName}</h2>
              <p className="text-sm text-ink-soft">{merchant.description}</p>
              {merchant.status === "approved" ? (
                <p className="flex items-center gap-1 text-xs font-semibold text-success">
                  <Check size={14} strokeWidth={2.6} aria-hidden />
                  Boutique vérifiée
                </p>
              ) : null}
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
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
            {catalogue.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </Section>
      </ScreenBody>
    </>
  );
}
