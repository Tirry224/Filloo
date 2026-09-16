"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { House, MessageCircle, Package, Store } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * La barre d'onglets de l'espace COMMERÇANT — quatre onglets.
 *
 * ELLE EN A LONGTEMPS EU TROIS, ET C'ÉTAIT TROP PEU
 * « Ma boutique » mélangeait deux choses que le commerçant ne fait pas en
 * même temps : consulter son activité (combien de messages, combien de
 * produits en ligne) et TENIR son catalogue (ajouter, modifier, masquer).
 * Le même écran servait de tableau de bord et de liste de produits, donc
 * ni l'un ni l'autre correctement : les chiffres poussaient la liste vers
 * le bas, et la liste noyait les chiffres.
 *
 * Le prototype (`design/`) tranchait déjà ce point avec quatre onglets —
 * Accueil, Produits, Messages, Boutique. L'application n'avait jamais
 * suivi. Ce découpage est repris ici, dans les couleurs et les composants
 * de Makiti, pas dans ceux de la maquette.
 *
 * « Rechercher » reste absent, et ce n'est pas un oubli : chercher des
 * produits est un geste de client. Une personne qui veut les deux crée
 * son compte client lié et bascule explicitement (`SwitchSpaceCard`) ; à
 * tout instant un seul espace est actif.
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
/* Les quatre `match` sont volontairement DISJOINTS : deux onglets allumés
   en même temps, c'est une barre qui ment sur l'endroit où l'on est.
   `/vendeur` est donc testé à l'identique, jamais en préfixe — sans quoi
   « Accueil » s'allumerait sur tout l'espace. */
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
    /* Les écrans d'un produit — ajout, modification, feuille d'actions —
       vivent tous sous `/vendeur/produits`, donc le préfixe suffit et
       l'onglet reste allumé pendant qu'on travaille sur un produit. */
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
    /* Nommé « Compte » auparavant, alors que l'écran édite la BOUTIQUE —
       nom, ville, WhatsApp, description — et ne contient les réglages de
       compte qu'en second. L'intitulé décrit maintenant ce qu'on y
       trouve d'abord. */
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
