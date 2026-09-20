"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { House, MessageCircle, Search, User } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * La barre d'onglets de l'espace CLIENT — et elle ne sert que lui.
 *
 * DEUX COMPOSANTS PLUTÔT QU'UN AVEC UNE PROP `space` : l'ancien `BottomNav`
 * choisissait d'après une prop qui valait « client » par DÉFAUT, donc tout
 * écran oubliant `space="merchant"` affichait la barre du client sans l'avoir
 * décidé — invisible à la relecture, visible en production quand un
 * commerçant touche « Rechercher » et se retrouve dans le fil d'achat. Ici
 * c'est le LAYOUT qui rend l'une ou l'autre : un écran de `(client)` n'a
 * aucun moyen de demander celle du commerçant (décision 8 de docs/SPEC.md).
 *
 * Composant client pour lire l'onglet actif dans le chemin (`usePathname`),
 * sans exiger de JavaScript : Next le rend sur le serveur au premier
 * chargement, donc `aria-current` et la couleur sont corrects dans le HTML
 * initial et les onglets restent des `<a>` (R7 de docs/PERFORMANCE.md).
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
