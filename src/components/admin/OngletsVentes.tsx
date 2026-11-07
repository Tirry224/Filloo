import Link from "next/link";
import { cn } from "@/lib/cn";

/** Les deux choses que Filloo vend, sous le même onglet « Ventes ». */
export function OngletsVentes({ actif }: { actif: "publicite" | "abonnements" | "credits" }) {
  const onglets = [
    { cle: "publicite", libelle: "Publicité", href: "/admin/publicite" },
    { cle: "abonnements", libelle: "Abonnements", href: "/admin/abonnements" },
    { cle: "credits", libelle: "Crédits", href: "/admin/credits" },
  ] as const;
  return (
    <nav aria-label="Ventes" className="grid grid-cols-3 gap-1 rounded-lg bg-paper p-1">
      {onglets.map((o) => (
        <Link
          key={o.cle}
          href={o.href}
          aria-current={o.cle === actif ? "page" : undefined}
          className={cn(
            "flex h-tap items-center justify-center rounded-md text-sm font-semibold",
            o.cle === actif ? "bg-surface text-ink shadow-[0_1px_2px_rgb(24_43_73/0.12)]" : "text-ink-soft",
          )}
        >
          {o.libelle}
        </Link>
      ))}
    </nav>
  );
}
