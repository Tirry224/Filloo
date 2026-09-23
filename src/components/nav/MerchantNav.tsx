"use client";

import { House, MessageCircle, Package, Store } from "lucide-react";
import { NavBar, type NavTab } from "@/components/nav/NavBar";

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
    match: (p: string) => p.startsWith("/vendeur/boutique"),
  },
] as const;

export function MerchantNav({ unreadCount = 0 }: { unreadCount?: number }) {
  return <NavBar tabs={TABS} unreadCount={unreadCount} label="Navigation commerçant" />;
}
