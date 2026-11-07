import Link from "next/link";
import { Megaphone } from "lucide-react";
import { cn } from "@/lib/cn";

const TEXTES = {
  accueil: { titre: "Votre produit ici", detail: "En tête de l'accueil, vu par tous les visiteurs." },
  recherche: { titre: "Votre produit ici", detail: "En tête de cette recherche." },
  categorie: { titre: "Votre produit ici", detail: "En tête de cette catégorie." },
  boutique: { titre: "Votre boutique ici", detail: "Dans « Boutiques à découvrir »." },
} as const;

/**
 * L'emplacement publicitaire VIDE, montré tel quel (décision du porteur du
 * projet, 2026-11-07) : un encart sobre, en pointillés, qui ne se fait
 * jamais passer pour un produit. Il mène un commerçant vers sa page
 * Publicité ; un visiteur sans boutique passe par l'inscription (garde de
 * l'espace commerçant). Il disparaît dès qu'une campagne occupe la place.
 */
export function EncartPub({ emplacement, className }: { emplacement: keyof typeof TEXTES; className?: string }) {
  const { titre, detail } = TEXTES[emplacement];
  return (
    <Link
      href="/vendeur/publicite"
      className={cn(
        "flex items-center gap-3 rounded-lg border border-dashed border-line-strong bg-surface px-3.5 py-2.5",
        className,
      )}
    >
      <Megaphone size={18} strokeWidth={1.9} className="shrink-0 text-ink-soft" aria-hidden />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-sm font-semibold">{titre}</span>
        <span className="truncate text-2xs text-ink-soft">{detail}</span>
      </span>
      <span className="shrink-0 text-xs font-semibold text-accent">Faire de la pub</span>
    </Link>
  );
}
