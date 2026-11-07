import { cn } from "@/lib/cn";
import type { FormulePayante } from "@/lib/data/abonnements";

/**
 * Le badge d'abonnement (0049) : il dit le NIVEAU d'abonnement, rien de
 * plus. Ce n'est ni une certification de la boutique, ni « Sponsorisé »
 * (qui veut dire qu'un emplacement a été payé). Même forme pour les deux,
 * seules la couleur et l'inscription changent.
 */
export function BadgeFormule({ formule, className }: { formule: FormulePayante; className?: string }) {
  return (
    <span
      title={formule === "pro" ? "Boutique abonnée Pro" : "Boutique abonnée Business"}
      className={cn(
        "inline-flex w-fit shrink-0 items-center rounded-sm px-1.5 py-px text-[0.625rem] leading-4 font-bold tracking-wide",
        formule === "pro" ? "bg-pro-soft text-pro-ink" : "bg-business-soft text-business-ink",
        className,
      )}
    >
      {formule === "pro" ? "PRO" : "BUSINESS"}
    </span>
  );
}
