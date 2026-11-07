import Link from "next/link";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Photo } from "@/components/ui/Photo";
import { PriceTag } from "./PriceTag";
import { cn } from "@/lib/cn";
import type { Product } from "@/lib/types";

/**
 * `sponsorise` : la carte d'une publicité (0047). Son lien passe par
 * `/pub/[campagne]`, qui compte le clic ; la mention « Sponsorisé » est
 * obligatoire, pour ne jamais faire passer une annonce payée pour un
 * résultat ordinaire.
 *
 * `prioritaire` : la photo est visible dès l'ouverture (les premières
 * cartes d'une liste) et se demande tout de suite, au lieu d'attendre le
 * reste de la page. Mesuré le 2026-11-07 en 3G : c'était le contenu
 * principal de l'accueil et des boutiques, affiché à 3,6 s (11 s en 3G
 * lente) parce que chargé « plus tard » (docs/PERFORMANCE.md, R2 bis).
 *
 * `prefetch={false}` : appliquer enfin la règle R2 — une liste de 24
 * produits ne précharge pas 24 fiches pour une seule ouverte.
 */
export const CARTES_PRIORITAIRES = 4;

export function ProductCard({
  product,
  sponsorise,
  prioritaire = false,
}: {
  product: Product;
  sponsorise?: { campagneId: string };
  prioritaire?: boolean;
}) {
  const sold = product.status === "sold";

  return (
    <Link href={sponsorise ? `/pub/${sponsorise.campagneId}` : `/produit/${product.id}`} prefetch={false} className="block">
      <Card className={cn("flex h-full flex-col", sold && "opacity-60")}>
        <Photo ratio="card" src={product.imageUrls[0]} alt={product.title} priority={prioritaire} />
        <div className="flex flex-col gap-1.5 px-3 pt-2.5 pb-3">
          {sponsorise ? <span className="text-2xs font-semibold tracking-wide text-ink-soft uppercase">Sponsorisé</span> : null}
          <h3 className="text-sm leading-snug font-semibold">{product.title}</h3>
          <PriceTag amount={product.priceGnf} struck={sold} />
          {/* `div` et non `p` : `Avatar` est une `div`, interdite dans un `p`. */}
          <div className="flex items-center gap-1.5 text-2xs text-ink-soft">
            {product.merchant.photoUrl ? (
              <Avatar name={product.merchant.shopName} kind="shop" size={18} src={product.merchant.photoUrl} />
            ) : null}
            <span>
              {product.merchant.shopName} · {product.merchant.city}
            </span>
          </div>
          {sold ? (
            <Badge>Vendu</Badge>
          ) : product.isNegotiable ? (
            <Badge tone="accent">Négociable</Badge>
          ) : null}
        </div>
      </Card>
    </Link>
  );
}
