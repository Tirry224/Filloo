"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

export type NavTab = {
  label: string;
  href: string;
  icon: LucideIcon;
  match: (pathname: string) => boolean;
};

/**
 * Le DESSIN d'une barre d'onglets — jamais son contenu.
 *
 * POURQUOI CE FICHIER EXISTE. `ClientNav` et `MerchantNav` portaient le
 * même balisage à la virgule près ; seule la liste des onglets différait.
 * Tant que l'application n'avait qu'une mise en page, cette copie coûtait
 * peu. Adapter aux grands écrans la rendait coûteuse : chaque classe
 * responsive aurait dû être écrite deux fois, et la première divergence
 * aurait donné deux espaces qui ne se ressemblent plus.
 *
 * LA DÉCISION 8 DE docs/SPEC.md EST INTACTE. Ce composant est un dessin,
 * pas une barre : il n'a pas de liste d'onglets par défaut, donc aucun
 * écran ne peut « oublier » laquelle il affiche. `ClientNav` et
 * `MerchantNav` restent deux composants distincts, chacun rendu par SON
 * layout, chacun portant SES onglets en dur. Ce qui était interdit —
 * qu'un écran de `(client)` obtienne la barre du commerçant — le reste :
 * il faudrait pour cela appeler `NavBar` avec les onglets du commerçant,
 * ce qu'aucun écran ne fait puisqu'aucun écran ne rend de barre.
 *
 * DEUX FORMES, UN SEUL COMPOSANT :
 *
 * - Téléphone : barre horizontale collée en bas, quatre onglets de
 *   largeur égale. Le pouce l'atteint, c'est là qu'elle doit être.
 * - Grand écran (`lg:`) : barre LATÉRALE à gauche, collée en haut. Sur un
 *   écran de portable, une barre en bas est à 40 cm des doigts et loin
 *   des yeux ; la verticale suit en plus la convention de tout logiciel
 *   de bureau.
 *
 * L'ORDRE DU DOM ne change pas d'une forme à l'autre : la barre reste
 * APRÈS le contenu, et c'est `order` qui la place à gauche. Le clavier
 * traverse donc le contenu avant la navigation — un saut vers le contenu
 * gratuit, alors qu'une barre placée avant obligerait à tabuler quatre
 * fois pour atteindre la page à chaque chargement.
 */
export function NavBar({
  tabs,
  unreadCount = 0,
  label,
}: {
  tabs: readonly NavTab[];
  unreadCount?: number;
  label: string;
}) {
  const pathname = usePathname();

  return (
    <nav
      aria-label={label}
      className={cn(
        "sticky bottom-0 flex shrink-0 border-t border-line bg-surface",
        "lg:top-0 lg:bottom-auto lg:h-dvh lg:w-rail lg:flex-col lg:gap-1",
        "lg:border-t-0 lg:border-r lg:p-3 lg:pt-5",
        "lg:order-first",
      )}
    >
      {/* PAS de nom de l'application ici, bien qu'un logiciel de bureau en
          mette d'ordinaire un en haut de sa barre latérale : les cinq
          écrans à onglets portent déjà « Makiti » dans leur barre du haut.
          Un premier essai l'avait ajouté, et l'aperçu montrait le nom deux
          fois à trente centimètres d'intervalle. */}
      {tabs.map(({ label: tabLabel, href, icon: Icon, match }) => {
        const isActive = match(pathname);
        const badge = tabLabel === "Messages" && unreadCount > 0 ? unreadCount : 0;
        return (
          <Link
            key={tabLabel}
            href={href}
            aria-current={isActive ? "page" : undefined}
            aria-label={badge > 0 ? `${tabLabel}, ${badge} non lus` : undefined}
            className={cn(
              "flex h-nav flex-1 flex-col items-center justify-center gap-0.5 text-2xs",
              /* Sur grand écran l'onglet redevient une ligne ordinaire :
                 icône, intitulé, et plus de `flex-1` — sinon les quatre se
                 partageraient toute la hauteur de l'écran. */
              "lg:h-auto lg:w-full lg:flex-none lg:flex-row lg:justify-start lg:gap-3 lg:rounded-lg lg:px-3 lg:py-2.5 lg:text-sm",
              isActive
                ? "font-semibold text-accent lg:bg-accent-soft"
                : "font-medium text-ink-soft lg:hover:bg-paper",
            )}
          >
            <span className="relative">
              <Icon size={22} strokeWidth={isActive ? 2 : 1.8} aria-hidden />
              {badge > 0 ? (
                <span
                  aria-hidden
                  className="absolute -top-1 -right-2 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-accent px-1 text-2xs font-bold text-on-accent lg:hidden"
                >
                  {badge > 9 ? "9+" : badge}
                </span>
              ) : null}
            </span>
            {tabLabel}
            {/* Sur grand écran le compteur se pose en BOUT DE LIGNE plutôt
                qu'en pastille sur l'icône : la place existe, et un chiffre
                lisible vaut mieux qu'un « 9+ ». */}
            {badge > 0 ? (
              <span
                aria-hidden
                className="ml-auto hidden h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1.5 text-2xs font-bold text-on-accent lg:flex"
              >
                {badge > 99 ? "99+" : badge}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
