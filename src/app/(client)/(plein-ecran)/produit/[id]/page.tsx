import { notFound } from "next/navigation";
import { Check, Flag, MessageCircle } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Photo } from "@/components/ui/Photo";
import { Notice } from "@/components/ui/Notice";
import { Screen, ScreenBody, ScreenFooter, Section } from "@/components/ui/Screen";
import { PriceTag } from "@/components/product/PriceTag";
import { MerchantCard } from "@/components/product/MerchantCard";
import { createClient } from "@/lib/supabase/server";
import { getProduct } from "@/lib/data/products";
import Link from "next/link";

/** Fiche produit — écrans 7 et 8 de docs/ECRANS.md. */
export default async function ProductPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  /* `?info=` est posé par `reportProductAction` : sans lui, signaler un
     produit refermait la feuille sans rien dire, là où signaler une
     conversation confirmait. */
  searchParams: Promise<{ info?: string }>;
}) {
  /* Depuis Next 15, `params` est une promesse : la page peut commencer à
     s'afficher avant que le routeur ait fini de résoudre l'URL. */
  const { id } = await params;
  const { info } = await searchParams;
  const supabase = await createClient();
  const product = await getProduct(supabase, id);
  if (!product) notFound();

  /* wa.me n'accepte que des chiffres, indicatif compris et sans « + ».
     Les commerçants saisissent leur numéro comme ils l'écrivent — avec
     espaces, tirets ou « +224 » — donc on ne garde que les chiffres. Un
     champ qui n'en contient aucun est traité comme absent. */
  const waNumber = product.merchant.whatsappPhone?.replace(/\D/g, "") || null;

  const sold = product.status === "sold";

  return (
    <Screen>
      <ScreenBody>
        {info ? <Notice tone="success">{info}</Notice> : null}
        <div className="relative">
          <Link href={`/produit/${product.id}/photos`} aria-label="Voir les photos">
            <Photo
              ratio="hero"
              src={product.imageUrls[0]}
              alt={product.title}
              priority
              label={sold ? undefined : `Photo 1 sur ${product.imageUrls.length}`}
              className={sold ? "grayscale" : ""}
            />
          </Link>
          <Link
            href="/"
            aria-label="Retour"
            className="absolute top-3.5 left-3.5 flex size-10 items-center justify-center rounded-full bg-surface/90"
          >
            <span className="text-lg leading-none">←</span>
          </Link>
          {sold ? (
            <div className="absolute inset-0 flex items-center justify-center">
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
            {/* Ce bouton n'avait NI href NI onClick : rendu en <button
                type="button"> inerte, il était donc une promesse que rien
                ne tenait — et sur un écran sans compte, WhatsApp est
                présenté comme l'échappatoire la plus crédible en Guinée.
                Le numéro existait pourtant en base ; il n'était
                simplement pas remonté jusqu'ici par `getProduct`.

                Il disparaît quand la boutique n'a pas donné de numéro,
                plutôt que de rester affiché sans rien faire : un bouton
                absent se comprend, un bouton mort se réessaie. */}
            {waNumber ? (
              <Button
                variant="secondary"
                fullWidth={false}
                href={`https://wa.me/${waNumber}`}
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
