"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { House, MessageCircle, Search, User } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * La barre d'onglets de l'espace CLIENT — et elle ne sert que lui.
 *
 * POURQUOI DEUX COMPOSANTS PLUTÔT QU'UN AVEC UNE PROP `space`
 * L'ancien `BottomNav` portait les deux listes d'onglets et choisissait
 * d'après une prop. L'intention était juste (décision 8 de docs/SPEC.md :
 * les deux rôles n'ont pas la même barre), mais la mécanique laissait la
 * porte ouverte : la prop valait « client » par DÉFAUT, et six écrans sur
 * les onze qui rendaient une barre passaient `space="merchant"`. Tous les
 * autres affichaient la barre du client sans l'avoir décidé. Un oubli de
 * prop ne se voit pas à la relecture — il se voit en production, quand un
 * commerçant touche « Rechercher » et se retrouve dans le fil d'achat.
 *
 * Ici, l'espace n'est plus une valeur qu'on passe : c'est le LAYOUT qui
 * rend cette barre-ci ou l'autre. Un écran de `(client)` ne peut pas
 * afficher la navigation du commerçant, parce qu'il n'a aucun moyen de la
 * demander. C'est la différence entre une règle et une convention.
 *
 * POURQUOI UN COMPOSANT CLIENT
 * L'onglet actif se lit dans le chemin, via `usePathname`. Ça n'oblige
 * personne à exécuter du JavaScript : Next rend ce composant sur le
 * serveur au premier chargement, `aria-current` et la couleur sont donc
 * corrects dans le HTML initial. La contrainte R7 de docs/PERFORMANCE.md
 * (tout doit marcher sans JavaScript) est tenue — vérifiable en coupant
 * JS : les onglets restent des `<a>` qui naviguent.
 */
const TABS = [
  { label: "Accueil", href: "/", icon: House, match: (p: string) => p === "/" },
  {
    label: "Rechercher",
    href: "/recherche",
    icon: Search,
    match: (p: string) => p.startsWith("/recherche"),
  },
  {
    label: "Messages",
    href: "/messages",
    icon: MessageCircle,
    match: (p: string) => p.startsWith("/messages"),
  },
  {
    label: "Compte",
    href: "/compte",
    icon: User,
    match: (p: string) => p.startsWith("/compte") || p.startsWith("/boutique"),
  },
] as const;

export function ClientNav({ unreadCount = 0 }: { unreadCount?: number }) {
  const pathname = usePathname();

  return (
    <nav className="sticky bottom-0 flex shrink-0 border-t border-line bg-surface">
      {TABS.map(({ label, href, icon: Icon, match }) => {
        const isActive = match(pathname);
        const badge = label === "Messages" && unreadCount > 0 ? unreadCount : 0;
        return (
          <Link
            key={label}
            href={href}
            aria-current={isActive ? "page" : undefined}
            aria-label={badge > 0 ? `${label}, ${badge} non lus` : undefined}
            className={cn(
              "flex h-nav flex-1 flex-col items-center justify-center gap-0.5 text-2xs",
              isActive ? "font-semibold text-accent" : "font-medium text-ink-soft",
            )}
          >
            <span className="relative">
              <Icon size={22} strokeWidth={isActive ? 2 : 1.8} aria-hidden />
              {badge > 0 ? (
                <span
                  aria-hidden
                  className="absolute -top-1 -right-2 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-accent px-1 text-2xs font-bold text-on-accent"
                >
                  {badge > 9 ? "9+" : badge}
                </span>
              ) : null}
            </span>
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
