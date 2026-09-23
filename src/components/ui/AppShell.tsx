import { cn } from "@/lib/cn";

/**
 * LA COQUILLE DES ÉCRANS À ONGLETS. Elle ne décide QUE de deux choses : le
 * plafond absolu de l'application, et le côté où vit la barre de
 * navigation. La largeur du contenu, elle, appartient à `TabScreen`, que
 * chaque écran règle selon la forme de ce qu'il montre — une grille de
 * produits et une liste de conversations n'ont pas la même largeur utile.
 *
 * La coquille prend donc toute la largeur disponible jusqu'à
 * `max-w-wide`, et le vide éventuel est absorbé par le centrage de
 * `TabScreen`, jamais laissé à droite du contenu.
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
        "mx-auto flex min-h-dvh w-full max-w-wide flex-col bg-paper",
        "wide:border-x wide:border-line lg:flex-row",
        className,
      )}
    >
      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
      {nav}
    </div>
  );
}
