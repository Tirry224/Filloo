import { cn } from "@/lib/cn";

/**
 * Le cadre de tout écran de l'application.
 *
 * `max-w-app` centre une colonne de largeur téléphone plutôt que d'étirer
 * l'interface : une ligne de texte de 1400 px ne se lit pas. `min-h-dvh`
 * prend la hauteur RÉELLE de la zone visible, là où `100vh` ignore la
 * barre d'adresse et fait dépasser le contenu.
 */
export function Screen({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("mx-auto flex min-h-dvh w-full max-w-app flex-col bg-paper", className)}>
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
