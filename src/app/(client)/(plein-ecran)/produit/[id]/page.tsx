import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Check, Flag, MessageCircle } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button, buttonClasses } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { Screen, ScreenBody, ScreenFooter, Section } from "@/components/ui/Screen";
import { PriceTag } from "@/components/product/PriceTag";
import { MerchantCard } from "@/components/product/MerchantCard";
import { ProductCarousel } from "@/components/product/ProductCarousel";
import { createClient } from "@/lib/supabase/server";
import { getProduct } from "@/lib/data/products";
import { produitEnCache } from "@/lib/data/catalogue-public";
import { getMyMerchant } from "@/lib/data/merchants";
import { formatGnf } from "@/lib/format";
import Link from "next/link";
import { compter } from "@/lib/analytics";
import { lienWhatsApp } from "@/lib/telephone";

/**
 * Le produit tel que le public le voit, depuis le cache partagé ; sinon
 * tel que CETTE session le voit — le brouillon de son propriétaire, ou un
 * produit publié depuis moins d'une minute.
 */
async function produitVisible(id: string) {
  return (await produitEnCache(id)) ?? getProduct(await createClient(), id);
}

/**
 * `produitVisible` est appelé ici ET dans la page ; le cache partagé
 * et la déduplication de requêtes de Next évitent le double aller-retour.
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
  const product = await produitVisible(id);

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
    alternates: { canonical: `/produit/${id}` },
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
  const product = await produitVisible(id);
  if (!product) notFound();
  const supabase = await createClient();

  /* `lienWhatsApp` pose l'indicatif « 224 », que la base ne stocke pas.
     Sans lui, l'adresse était `wa.me/622334455` — bien formée, mais ne
     désignant aucun compte : le bouton existait et ne menait nulle part. */
  const waHref = lienWhatsApp(product.merchant.whatsappPhone);

  const sold = product.status === "sold";

  /* Les deux comptes étant liés (décision 8), un client peut tomber sur un
     produit de sa propre boutique. « Contacter le vendeur » ne mènerait
     nulle part : on ne se contacte pas soi-même. */
  const myMerchant = await getMyMerchant(supabase);
  const own = myMerchant?.id === product.merchant.id;

  compter("produit_vu", { productId: product.id, merchantId: product.merchant.id });

  /* Les données structurées que Google lit pour afficher le prix et la
     disponibilité dans ses résultats (schema.org `Product`). Le `<`
     échappé empêche un titre de commerçant de fermer la balise. */
  const donneesStructurees = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.title,
    description: product.description ?? undefined,
    image: product.imageUrls.length > 0 ? product.imageUrls : undefined,
    category: product.category,
    offers: {
      "@type": "Offer",
      price: product.priceGnf,
      priceCurrency: "GNF",
      availability: sold ? "https://schema.org/SoldOut" : "https://schema.org/InStock",
      seller: { "@type": "Organization", name: product.merchant.shopName },
    },
  }).replace(/</g, "\\u003c");

  return (
    <Screen>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: donneesStructurees }} />
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
        ) : own ? (
          <Button variant="secondary">C&apos;est votre produit</Button>
        ) : (
          <>
            <Button icon={MessageCircle} href={`/produit/${product.id}/contacter`}>
              Contacter le vendeur
            </Button>
            {waHref ? (
              <a
                href={`/produit/${product.id}/whatsapp`}
                rel="nofollow"
                aria-label={`Contacter ${product.merchant.shopName} sur WhatsApp`}
                className={buttonClasses({
                  variant: "secondary",
                  fullWidth: false,
                  className: "w-control shrink-0 text-success",
                })}
              >
                WA
              </a>
            ) : null}
          </>
        )}
      </ScreenFooter>
    </Screen>
  );
}
