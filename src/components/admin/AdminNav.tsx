"use client";

import { BarChart3, Megaphone, MessageCircle } from "lucide-react";
import { NavBar, type NavTab } from "@/components/nav/NavBar";

/* Les trois `match` sont DISJOINTS, comme pour les autres espaces : deux
   onglets allumés à la fois font mentir la barre. « Messages » porte la
   pastille des non lus (`NavBar` la pose sur ce libellé). */
const TABS: readonly NavTab[] = [
  {
    label: "Messages",
    href: "/admin",
    icon: MessageCircle,
    match: (p: string) => p === "/admin" || p.startsWith("/admin/fil"),
  },
  {
    label: "Annonces",
    href: "/admin/annonces",
    icon: Megaphone,
    match: (p: string) => p.startsWith("/admin/annonces"),
  },
  {
    label: "Statistiques",
    href: "/admin/statistiques",
    icon: BarChart3,
    match: (p: string) => p.startsWith("/admin/statistiques"),
  },
] as const;

export function AdminNav({ unreadCount = 0 }: { unreadCount?: number }) {
  return <NavBar tabs={TABS} unreadCount={unreadCount} label="Navigation de l'équipe" />;
}
