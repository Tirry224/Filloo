import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Photo } from "@/components/ui/Photo";
import { PriceTag } from "./PriceTag";
import { cn } from "@/lib/cn";
import type { Product, ProductStatus } from "@/lib/types";

const STATUS: Record<ProductStatus, { label: string; tone: "success" | "neutral" } | null> = {
  active: { label: "Publié", tone: "success" },
  draft: { label: "Brouillon", tone: "neutral" },
  sold: { label: "Vendu", tone: "neutral" },
  hidden: { label: "Masqué", tone: "neutral" },
};

export function ProductRow({ product }: { product: Product }) {
  const status = STATUS[product.status];
  return (
    <Card className={cn("flex items-center gap-3 p-2.5", product.status === "sold" && "opacity-60")}>
      <Photo src={product.imageUrls[0]} ratio="free" className="size-14 shrink-0 rounded-md" iconSize={20} />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <h3 className="truncate text-base font-semibold">{product.title}</h3>
        <PriceTag amount={product.priceGnf} size="sm" />
      </div>
      {status ? <Badge tone={status.tone}>{status.label}</Badge> : null}
    </Card>
  );
}
