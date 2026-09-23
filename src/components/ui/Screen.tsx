import { cn } from "@/lib/cn";

/**
 * LA TABLE DES LARGEURS. Un écran ne choisit pas des pixels, il déclare la
 * FORME de son contenu, et cette table décide du reste. C'est le seul
 * endroit du projet qui combine les largeurs de `tokens.css`, pour qu'une
 * refonte des paliers soit une modification d'un fichier et non de
 * quarante-quatre.
 *
 * Chaque famille part de la colonne téléphone et s'élargit par paliers :
 * un écran ne saute jamais de 448 px à 1152 px d'un coup, parce qu'entre
 * les deux il y a les tablettes.
 *
 *   colonne — formulaires et pages de texte. S'arrête à 640 px : au-delà,
 *             l'œil perd le début de la ligne en arrivant à sa fin, et un
 *             champ « Nom » de 1200 px ne se relie plus à son intitulé.
 *   rangees — suites de lignes cliquables : menus, conversations,
 *             catalogue du commerçant. S'arrête à 768 px, sans quoi
 *             l'intitulé reste à gauche, le chevron part à l'extrême
 *             droite, et il faut traverser un désert pour relier deux
 *             morceaux de la même ligne.
 *   grille  — vignettes de produits. Seule famille à prendre toute la
 *             largeur, parce qu'une grille ne s'étire pas : elle ajoute
 *             des colonnes.
 *
 * `mx-auto` est dans le conteneur et non dans la table : AUCUN écran n'est
 * aligné à gauche dans un espace plus large que lui.
 */
const LARGEURS = {
  colonne: "max-w-app sm:max-w-lecture",
  rangees: "max-w-app sm:max-w-lecture md:max-w-rangees",
  grille: "max-w-app sm:max-w-lecture md:max-w-rangees lg:max-w-wide",
} as const;

export type Largeur = keyof typeof LARGEURS;

/**
 * Un écran PLEIN ÉCRAN, c'est-à-dire hors barre d'onglets : il porte lui-même
 * le fond, la hauteur et les bordures qui le détachent du vide.
 */
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

/**
 * Un écran À ONGLETS. La hauteur, le fond et les bordures appartiennent déjà
 * à `AppShell` ; il ne reste à porter que la largeur, et elle enveloppe la
 * barre du haut AVEC le contenu, faute de quoi un titre resterait à gauche
 * d'un contenu centré.
 */
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
