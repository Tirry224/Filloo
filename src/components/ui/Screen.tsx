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

/** Zone défilante. `flex-1` lui fait occuper tout l'espace restant. */
export function ScreenBody({ children, className }: { children: React.ReactNode; className?: string }) {
  return <main className={cn("flex flex-1 flex-col", className)}>{children}</main>;
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
