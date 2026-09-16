"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MessageCircle, Store, User } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * La barre d'onglets de l'espace COMMERÇANT — trois onglets, pas quatre.
 *
 * « Accueil » et « Rechercher » n'existent pas ici, et ce n'est pas un
 * oubli : chercher des produits est un geste de client. Une personne qui
 * veut les deux crée son compte client lié et bascule explicitement
 * (`SwitchSpaceCard`) ; à tout instant un seul espace est actif.
 *
 * TOUS LES LIENS RESTENT DANS `/vendeur`
 * C'est la propriété qui rend cette barre vérifiable d'un coup d'œil, et
 * elle remplace un mécanisme qui ne l'était pas : l'onglet « Messages »
 * pointait avant sur `/messages?vue=commercant`, c'est-à-dire sur un
 * écran de l'espace client rendu marchand par une query string. Un
 * paramètre perdu — un favori, un lien partagé, un retour arrière, une
 * redirection qui ne le repropage pas — et le commerçant atterrissait
 * dans sa boîte d'ACHETEUR. `src/lib/space.ts` existait uniquement pour
 * empêcher cette perte ; le paramètre supprimé, la fonction l'est aussi.
 *
 * La règle qui en découle : si un lien de cette barre ne commence pas par
 * `/vendeur`, c'est un bug, et il se voit sans lire le reste du fichier.
 */
const TABS = [
  {
    label: "Ma boutique",
    href: "/vendeur",
    icon: Store,
    /* `/vendeur/produits/...` allume bien cet onglet : gérer un produit,
       c'est tenir sa boutique. `/vendeur/boutique` en est exclu, sinon
       deux onglets s'allumeraient ensemble. */
    match: (p: string) => p === "/vendeur" || p.startsWith("/vendeur/produits"),
  },
  {
    label: "Messages",
    href: "/vendeur/messages",
    icon: MessageCircle,
    match: (p: string) => p.startsWith("/vendeur/messages"),
  },
  {
    label: "Compte",
    href: "/vendeur/boutique",
    icon: User,
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
