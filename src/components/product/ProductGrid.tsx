import { cn } from "@/lib/cn";

/**
 * LA GRILLE DE VIGNETTES, écrite une seule fois. Elle vivait en quatre
 * copies identiques — accueil, recherche, boutique, squelette de
 * chargement — et quatre copies d'une même valeur finissent toujours par
 * diverger sur la troisième.
 *
 * Les paliers suivent la largeur que `TabScreen largeur="grille"` accorde
 * au contenu : une grille ne s'étire pas quand la place vient, elle ajoute
 * une colonne, et la vignette garde partout à peu près la taille d'un
 * pouce.
 */
const GRILLE = "grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4";

export function ProductGrid({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn(GRILLE, className)}>{children}</div>;
}
