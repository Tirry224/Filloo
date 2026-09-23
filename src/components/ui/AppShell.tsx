import { cn } from "@/lib/cn";

/**
 * Le cadre des écrans À ONGLETS — les seuls qui s'élargissent.
 *
 * POURQUOI PAS `Screen`. `Screen` est utilisé par une quarantaine
 * d'écrans, dont tous les formulaires et toutes les pages de texte : les
 * élargir serait une régression, un champ de 1000 px de large étant plus
 * pénible à remplir qu'un champ de 400. Les écrans à onglets, eux, ne
 * servent qu'à PARCOURIR — un fil de produits, une liste de
 * conversations — et la largeur y rend un vrai service. D'où deux cadres,
 * et le fait que celui-ci ne soit rendu que par les deux layouts
 * `(onglets)`.
 *
 * TROIS PALIERS, parce que deux ne suffisaient pas : sans le palier
 * `md:`, une tablette de 834 px affichait la colonne téléphone de 448 px
 * au milieu de deux aplats vides. L'aperçu l'a montré, et c'est pour ça
 * qu'il existe.
 *
 * - Téléphone : colonne de 448 px, barre d'onglets en bas.
 * - Tablette (`md:`) : la colonne passe à 672 px, la barre reste en bas —
 *   une tablette se tient encore à deux mains.
 * - Grand écran (`lg:`) : le cadre passe à `max-w-wide` et la barre passe
 *   à gauche.
 *
 * CE QUI CHANGE À `lg:` :
 *
 * - Le cadre passe de la colonne téléphone (`max-w-app`) à `max-w-wide`,
 *   et de la colonne à la rangée.
 * - La barre d'onglets, rendue en dernier, se place à GAUCHE par `order`
 *   (voir `NavBar` pour la raison : le clavier traverse le contenu en
 *   premier).
 * - Une bordure de chaque côté détache le cadre du fond. Sans elle,
 *   l'application flotte au milieu d'un aplat et paraît inachevée.
 *
 * `min-w-0` sur la colonne de contenu n'est pas décoratif : sans lui, un
 * élément large — un titre de produit sans espace, une grille — refuse de
 * rétrécir et fait déborder toute la page horizontalement. C'est le bug
 * classique de toute mise en page flex.
 */
export function AppShell({
  nav,
  children,
  className,
}: {
  nav: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mx-auto flex min-h-dvh w-full max-w-app flex-col bg-paper md:max-w-2xl",
        "md:border-x md:border-line lg:max-w-wide lg:flex-row",
        className,
      )}
    >
      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
      {nav}
    </div>
  );
}
