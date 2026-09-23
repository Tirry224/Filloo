import { cn } from "@/lib/cn";

/**
 * Le cadre des écrans SANS onglets — formulaires, pages de texte,
 * authentification. C'est le cas le plus fréquent, d'où le nom le plus
 * court. Les écrans à onglets, eux, ont `AppShell`.
 *
 * `max-w-app` centre une colonne de largeur téléphone plutôt que d'étirer
 * l'interface, ET CELA NE CHANGE PAS SUR GRAND ÉCRAN : un champ de
 * 1000 px se remplit plus mal qu'un champ de 400, et une ligne de texte
 * de 1400 px ne se lit pas. Élargir ces écrans-là serait une régression
 * déguisée en adaptation.
 *
 * Ce qui change à `lg:`, c'est seulement la bordure latérale : sans elle
 * la colonne flotte au milieu d'un aplat et paraît inachevée. Elle ne
 * coûte rien sur téléphone, où elle est hors de l'écran.
 *
 * `min-h-dvh` prend la hauteur RÉELLE de la zone visible, là où `100vh`
 * ignore la barre d'adresse et fait dépasser le contenu.
 */
export function Screen({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "mx-auto flex min-h-dvh w-full max-w-app flex-col bg-paper lg:border-x lg:border-line",
        className,
      )}
    >
      {children}
    </div>
  );
}

/**
 * Zone défilante. `flex-1` lui fait occuper tout l'espace restant.
 *
 * `rangees` sert aux écrans dont le contenu est une SUITE DE LIGNES —
 * un menu, une liste de conversations, un catalogue en lignes — par
 * opposition à une grille. Dans le cadre large d'`AppShell`, une ligne
 * étirée sur 880 px met son intitulé à gauche et son chevron à
 * l'extrême droite, avec un désert au milieu : l'œil doit traverser
 * l'écran pour relier deux morceaux de la même ligne. On plafonne donc
 * ces écrans-là, alignés à gauche sous la barre du haut.
 *
 * Une GRILLE, elle, ne prend pas ce plafond : ses vignettes se
 * multiplient au lieu de s'étirer, et la largeur lui profite vraiment.
 * C'est toute la règle, et elle se décide écran par écran parce que
 * seule la forme du contenu peut trancher.
 *
 * Sur téléphone et tablette le plafond ne s'applique pas : le cadre y
 * est déjà plus étroit que lui.
 */
export function ScreenBody({
  children,
  className,
  rangees = false,
}: {
  children: React.ReactNode;
  className?: string;
  rangees?: boolean;
}) {
  return (
    <main className={cn("flex flex-1 flex-col", rangees && "lg:max-w-2xl", className)}>
      {children}
    </main>
  );
}

/** Barre d'actions collée en bas, au-dessus du contenu. */
export function ScreenFooter({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("sticky bottom-0 border-t border-line bg-surface px-4 pt-3 pb-4", className)}>
      {children}
    </div>
  );
}

/** Bloc de contenu à la gouttière standard de l'application. */
export function Section({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("flex flex-col gap-3 p-4", className)}>{children}</div>;
}
