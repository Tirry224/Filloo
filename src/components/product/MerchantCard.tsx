import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Card } from "@/components/ui/Card";
import { BadgeFormule } from "@/components/abonnement/BadgeFormule";
import type { FormulePayante } from "@/lib/data/abonnements";
import type { Merchant } from "@/lib/types";

export function MerchantCard({
  merchant,
  badge,
}: {
  merchant: Pick<Merchant, "id" | "shopName" | "city" | "addressHint" | "photoUrl">;
  badge?: FormulePayante;
}) {
  return (
    <Link href={`/boutique/${merchant.id}`}>
      <Card className="flex items-center gap-3 p-3.5">
        <Avatar name={merchant.shopName} kind="shop" size={46} src={merchant.photoUrl} />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="flex min-w-0 items-center gap-2">
            <span className="truncate text-base font-semibold">{merchant.shopName}</span>
            {badge ? <BadgeFormule formule={badge} /> : null}
          </span>
          <span className="truncate text-xs text-ink-soft">
            {merchant.addressHint ? `${merchant.addressHint} · ` : ""}
            {merchant.city}
          </span>
        </div>
        <ChevronRight size={20} strokeWidth={2} className="shrink-0 text-ink-soft" aria-hidden />
      </Card>
    </Link>
  );
}
