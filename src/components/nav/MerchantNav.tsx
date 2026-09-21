"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { House, MessageCircle, Package, Store } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * La barre d'onglets de l'espace COMMERÇANT — quatre onglets comme le
 * prototype (`design/`) : avec trois, « Ma boutique » cumulait tableau de
 * bord et liste de produits. « Rechercher » est absent volontairement,
 * chercher étant un geste de client (on bascule par `SwitchSpaceCard`).
 *
 * TOUS les liens restent dans `/vendeur` : un lien qui n'y commence pas est
 * un bug, visible d'un coup d'œil.
 */
/* Les quatre `match` sont volontairement DISJOINTS : deux onglets allumés
   à la fois font mentir la barre. D'où `/vendeur` testé à l'identique. */
const TABS = [
  {
    label: "Accueil",
    href: "/vendeur",
    icon: House,
    match: (p: string) => p === "/vendeur",
  },
  {
    label: "Produits",
    href: "/vendeur/produits",
    icon: Package,
    /* Ajout, modification et feuille d'actions vivent tous sous
       `/vendeur/produits` : le préfixe garde l'onglet allumé. */
    match: (p: string) => p.startsWith("/vendeur/produits"),
  },
  {
    label: "Messages",
    href: "/vendeur/messages",
    icon: MessageCircle,
    match: (p: string) => p.startsWith("/vendeur/messages"),
  },
  {
    label: "Boutique",
    href: "/vendeur/boutique",
    icon: Store,
    // « Boutique » et non « Compte » : l'écran édite d'abord la boutique,
    // les réglages viennent après.
    match: (p: string) => p.startsWith("/vendeur/boutique"),
  },
] as const;

export function MerchantNav({ unreadCount = 0 }: { unreadCount?: number }) {
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
