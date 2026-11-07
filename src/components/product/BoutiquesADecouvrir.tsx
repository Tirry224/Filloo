import Link from "next/link";
import { Avatar } from "@/components/ui/Avatar";
import { cn } from "@/lib/cn";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { EncartPub } from "@/components/publicite/EncartPub";
import { lienPub, type BoutiqueEnAvant } from "@/lib/data/publicite";

/**
 * La rangée « Boutiques à découvrir » de l'accueil : des boutiques mises en
 * avant (0047), marquées comme telles. Posée dans la grille, sous la
 * première rangée de produits (décision du 2026-11-07), d'où `className`
 * et l'absence de `Section` : la grille donne déjà les marges.
 */
export function BoutiquesADecouvrir({ boutiques, className }: { boutiques: BoutiqueEnAvant[]; className?: string }) {
  // Place libre : l'encart la montre, sans fausse boutique (2026-11-07).
  if (!boutiques.length) {
    return <EncartPub emplacement="boutique" className={className} />;
  }
  return (
    <div className={cn("flex flex-col gap-2 py-1", className)}>
      <div className="flex items-baseline justify-between">
        <SectionLabel>Boutiques à découvrir</SectionLabel>
        <span className="text-2xs font-semibold tracking-wide text-ink-soft uppercase">Sponsorisé</span>
      </div>
      <div className="-mx-4 flex gap-2.5 overflow-x-auto px-4 pb-1">
        {boutiques.map((b) => (
          <Link
            key={b.campagneId}
            href={lienPub(b.campagneId)}
            className="flex w-32 shrink-0 flex-col items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 py-3 text-center"
          >
            <Avatar name={b.nom} kind="shop" size={48} src={b.photoUrl ?? undefined} />
            <span className="line-clamp-2 text-sm leading-snug font-semibold">{b.nom}</span>
            <span className="text-2xs text-ink-soft">
              {b.ville} · {b.produitsActifs} produit{b.produitsActifs > 1 ? "s" : ""}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
