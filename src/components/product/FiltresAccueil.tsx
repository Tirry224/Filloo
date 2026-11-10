import Link from "next/link";
import { Footprints, LayoutGrid, Search, Shirt, ShoppingBag } from "lucide-react";
import { Section } from "@/components/ui/Screen";
import { cn } from "@/lib/cn";
import { GENRES_FILTRE, type Famille } from "@/lib/mode";

/** Les rayons de l'accueil ; « Tout » n'en filtre aucun. */
const RAYONS = [
  { valeur: "", libelle: "Tout", icon: LayoutGrid },
  { valeur: "vetements", libelle: "Vêtements", icon: Shirt },
  { valeur: "chaussures", libelle: "Chaussures", icon: Footprints },
  { valeur: "accessoires", libelle: "Accessoires", icon: ShoppingBag },
] as const;

/** Le rayon d'une adresse, ou "" s'il est absent ou inconnu. */
export function lireRayon(brut: string | undefined): Famille | "" {
  return RAYONS.find((r) => r.valeur !== "" && r.valeur === brut)?.valeur ?? "";
}

/**
 * Les deux seuls choix de l'accueil (2026-11-10) : POUR QUI, une barre
 * en quatre parts, puis QUEL RAYON, quatre tuiles. Le reste (catégories,
 * taille, couleur, prix) est dans Recherche, à un lien.
 */
export function FiltresAccueil({ genre, rayon }: { genre: string; rayon: string }) {
  /** L'adresse de l'accueil avec un choix changé, l'autre gardé. */
  const accueil = (modifs: { genre?: string; rayon?: string }) => {
    const suivant = { genre, rayon, ...modifs };
    const params = new URLSearchParams();
    if (suivant.genre) params.set("genre", suivant.genre);
    if (suivant.rayon) params.set("rayon", suivant.rayon);
    const qs = params.toString();
    return qs ? `/?${qs}` : "/";
  };

  return (
    <Section className="gap-3 pb-1">
      {/* 1. Pour qui : une seule barre, quatre parts égales. */}
      <nav aria-label="Pour qui" className="grid grid-cols-4 rounded-full border border-line bg-surface p-1">
        {[{ valeur: "", libelle: "Tout" }, ...GENRES_FILTRE].map((g) => (
          <Link
            key={g.valeur || "tout"}
            href={accueil({ genre: g.valeur })}
            aria-current={g.valeur === genre ? "page" : undefined}
            className={cn(
              "rounded-full py-2 text-center text-sm font-semibold",
              g.valeur === genre ? "bg-ink text-paper" : "text-ink-soft",
            )}
          >
            {g.libelle}
          </Link>
        ))}
      </nav>

      {/* 2. Quel rayon : quatre tuiles, l'icône au-dessus du mot. */}
      <nav aria-label="Rayon" className="grid grid-cols-4 gap-2">
        {RAYONS.map((r) => {
          const actif = r.valeur === rayon;
          return (
            <Link
              key={r.valeur || "tout"}
              href={accueil({ rayon: r.valeur })}
              aria-current={actif ? "page" : undefined}
              className={cn(
                "flex flex-col items-center gap-1.5 rounded-xl border px-1 py-3 text-xs font-semibold",
                actif ? "border-ink bg-ink text-paper" : "border-line bg-surface text-ink",
              )}
            >
              <r.icon size={22} strokeWidth={1.7} aria-hidden />
              {r.libelle}
            </Link>
          );
        })}
      </nav>

      {/* Le détail (16 catégories, taille, couleur, prix) : un seul lien clair. */}
      <Link
        href={genre ? `/recherche?q=&genre=${genre}` : "/recherche"}
        className="flex items-center justify-center gap-1.5 text-sm font-semibold text-accent"
      >
        <Search size={15} strokeWidth={2} aria-hidden />
        Chercher par catégorie, taille, couleur ou prix
      </Link>
    </Section>
  );
}
