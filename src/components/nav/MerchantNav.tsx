"use client";

import { House, MessageCircle, Package, Store } from "lucide-react";
import { NavBar, type NavTab } from "@/components/nav/NavBar";

/**
 * La barre d'onglets de l'espace COMMERÇANT — quatre onglets comme le
 * prototype (`design/`) : avec trois, « Ma boutique » cumulait tableau de
 * bord et liste de produits. « Rechercher » est absent volontairement,
 * chercher étant un geste de client (on bascule par `SwitchSpaceCard`).
 *
 * TOUS les liens restent dans `/vendeur` : un lien qui n'y commence pas est
 * un bug, visible d'un coup d'œil.
 *
 * Le DESSIN vit dans `NavBar` (voir `ClientNav` pour le pourquoi) ; ici,
 * rien que les onglets.
 */
/* Les quatre `match` sont volontairement DISJOINTS : deux onglets allumés
   à la fois font mentir la barre. D'où `/vendeur` testé à l'identique. */
const TABS: readonly NavTab[] = [
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
  return <NavBar tabs={TABS} unreadCount={unreadCount} label="Navigation commerçant" />;
}
