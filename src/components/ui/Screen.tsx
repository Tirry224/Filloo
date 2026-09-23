import { cn } from "@/lib/cn";

const LARGEURS = {
  colonne: "max-w-app sm:max-w-lecture",
  rangees: "max-w-app sm:max-w-lecture md:max-w-rangees",
  grille: "max-w-app sm:max-w-lecture md:max-w-rangees lg:max-w-wide",
} as const;

export type Largeur = keyof typeof LARGEURS;

export function Screen({
  children,
  className,
  largeur = "colonne",
}: {
  children: React.ReactNode;
  className?: string;
  largeur?: Largeur;
}) {
  return (
    <div
      className={cn(
        "mx-auto flex min-h-dvh w-full flex-col bg-paper sm:border-x sm:border-line",
        LARGEURS[largeur],
        className,
      )}
    >
      {children}
    </div>
  );
}

export function TabScreen({
  children,
  className,
  largeur,
}: {
  children: React.ReactNode;
  className?: string;
  largeur: Largeur;
}) {
  return (
    <div className={cn("mx-auto flex w-full flex-1 flex-col", LARGEURS[largeur], className)}>
      {children}
    </div>
  );
}

export function ScreenBody({ children, className }: { children: React.ReactNode; className?: string }) {
  return <main className={cn("flex flex-1 flex-col", className)}>{children}</main>;
}

export function ScreenFooter({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("sticky bottom-0 border-t border-line bg-surface px-4 pt-3 pb-4", className)}>
      {children}
    </div>
  );
}

export function Section({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("flex flex-col gap-3 p-4", className)}>{children}</div>;
}
