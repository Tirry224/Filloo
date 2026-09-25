import Link from "next/link";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Photo } from "@/components/ui/Photo";
import { PriceTag } from "./PriceTag";
import { cn } from "@/lib/cn";
import type { Product } from "@/lib/types";

export function ProductCard({ product }: { product: Product }) {
  const sold = product.status === "sold";

  return (
    <Link href={`/produit/${product.id}`} className="block">
      <Card className={cn("flex h-full flex-col", sold && "opacity-60")}>
        <Photo ratio="card" src={product.imageUrls[0]} alt={product.title} />
        <div className="flex flex-col gap-1.5 px-3 pt-2.5 pb-3">
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
