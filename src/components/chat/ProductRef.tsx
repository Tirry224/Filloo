import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Photo } from "@/components/ui/Photo";
import { PriceTag } from "@/components/product/PriceTag";
import { cn } from "@/lib/cn";
import type { Product } from "@/lib/types";

export function ProductRef({
  product,
}: {
  product: Pick<Product, "id" | "title" | "priceGnf" | "status"> & { imageUrl?: string };
}) {
  const sold = product.status === "sold";
  return (
    <div className="flex max-w-[80%] flex-col gap-1 self-start">
      <span className="text-2xs font-semibold tracking-wide text-ink-soft uppercase">Concerne</span>
      <Card className={cn("flex items-center gap-2.5 p-2", sold && "opacity-60")}>
        <Photo ratio="free" src={product.imageUrl} className="size-9.5 shrink-0 rounded-sm" iconSize={16} />
        <div className="flex flex-col gap-0.5 pr-1">
          <span className="text-xs leading-snug font-semibold">{product.title}</span>
          {sold ? <Badge>Vendu</Badge> : <PriceTag amount={product.priceGnf} size="sm" />}
        </div>
      </Card>
    </div>
  );
}
