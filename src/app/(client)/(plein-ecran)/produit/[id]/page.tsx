import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Check, Flag, MessageCircle } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { Screen, ScreenBody, ScreenFooter, Section } from "@/components/ui/Screen";
import { PriceTag } from "@/components/product/PriceTag";
import { MerchantCard } from "@/components/product/MerchantCard";
import { ProductCarousel } from "@/components/product/ProductCarousel";
import { createClient } from "@/lib/supabase/server";
import { getProduct } from "@/lib/data/products";
import { formatGnf } from "@/lib/format";
import Link from "next/link";
import { compter } from "@/lib/analytics";
import { lienWhatsApp } from "@/lib/telephone";

/**
 * `getProduct` est appelé ici ET dans la page ; le `cache()` de
 * `createClient` plus la déduplication de requêtes de Next évitent le
 * double aller-retour.
 *
 * Un produit hors catalogue (brouillon, masqué, boutique non approuvée)
 * n'arrive jamais ici : le RLS l'écarte, `getProduct` rend `null`, et la
 * page répond « n'existe pas ». L'indexation suit donc la visibilité
 * réelle sans qu'aucune règle séparée n'ait à être tenue à jour — une
 * seconde liste aurait dérivé.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  const product = await getProduct(supabase, id);

  if (!product) {
    return { title: "Produit introuvable", robots: { index: false, follow: false } };
  }

  const vendu = product.status === "sold";
  const titre = `${product.title} — ${formatGnf(product.priceGnf)}${vendu ? " (vendu)" : ""}`;
  const description =
    product.description?.slice(0, 200) ||
    `${product.title} chez ${product.merchant.shopName}, à ${product.merchant.city}. Contactez le commerçant sur Filloo.`;

  return {
    title: titre,
    description,
    openGraph: {
      type: "website",
      title: titre,
      description,
      /* Une seule photo : les aperçus n'en affichent qu'une, et les
         suivantes ne feraient qu'alourdir la page lue par le robot. */
      images: product.imageUrls.length > 0 ? [{ url: product.imageUrls[0], alt: product.title }] : undefined,
    },
    robots: vendu ? { index: false, follow: true } : undefined,
  };
}

export default async function ProductPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ info?: string }>;
}) {
  /* Depuis Next 15, `params` est une promesse : la page peut commencer à
     s'afficher avant que le routeur ait fini de résoudre l'URL. */
  const { id } = await params;
  const { info } = await searchParams;
  const supabase = await createClient();
  const product = await getProduct(supabase, id);
  if (!product) notFound();

  /* `lienWhatsApp` pose l'indicatif « 224 », que la base ne stocke pas.
     Sans lui, l'adresse était `wa.me/622334455` — bien formée, mais ne
     désignant aucun compte : le bouton existait et ne menait nulle part. */
  const waHref = lienWhatsApp(product.merchant.whatsappPhone);

  const sold = product.status === "sold";

  compter("produit_vu", { productId: product.id, merchantId: product.merchant.id });

  return (
    <Screen>
      <ScreenBody>
        {info ? <Notice tone="success">{info}</Notice> : null}
        <div className="relative">
          <ProductCarousel
            productId={product.id}
            imageUrls={product.imageUrls}
            title={product.title}
            sold={sold}
          />
          <Link
            href="/"
            aria-label="Retour"
            className="absolute top-3.5 left-3.5 flex size-10 items-center justify-center rounded-full bg-surface/90"
          >
            <span className="text-lg leading-none">←</span>
          </Link>
          {sold ? (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <span className="rounded-full bg-ink px-4 py-2 text-sm font-bold tracking-wide text-paper">
                VENDU
              </span>
            </div>
          ) : null}
        </div>

        <Section>
          <div className="flex flex-col gap-2">
            <h1 className="text-2xl font-bold">{product.title}</h1>
            <div className="flex items-center gap-2.5">
              <PriceTag amount={product.priceGnf} size="lg" struck={sold} />
              {product.isNegotiable && !sold ? <Badge tone="accent">Négociable</Badge> : null}
            </div>
            {sold ? null : (
              <p className="flex items-center gap-1.5 text-sm font-semibold text-success">
                <Check size={16} strokeWidth={2.4} aria-hidden />
                Disponible
              </p>
            )}
          </div>

          {product.description ? (
            <p className="text-base leading-relaxed text-ink-soft">{product.description}</p>
          ) : null}

          <MerchantCard merchant={product.merchant} />

          <Link
            href={`/produit/${product.id}/signaler`}
            className="flex items-center gap-1.5 text-sm text-ink-soft"
          >
            <Flag size={16} strokeWidth={1.8} aria-hidden />
            Signaler ce produit
          </Link>
        </Section>
      </ScreenBody>

      <ScreenFooter className="flex gap-2.5">
        {sold ? (
          <Button variant="secondary">Ce produit n&apos;est plus disponible</Button>
        ) : (
          <>
            <Button icon={MessageCircle} href={`/produit/${product.id}/contacter`}>
              Contacter le vendeur
            </Button>
            {waHref ? (
              <Button
                variant="secondary"
                fullWidth={false}
                href={waHref}
                aria-label={`Contacter ${product.merchant.shopName} sur WhatsApp`}
                className="w-control shrink-0 text-success"
              >
                WA
              </Button>
            ) : null}
          </>
        )}
      </ScreenFooter>
    </Screen>
  );
}
