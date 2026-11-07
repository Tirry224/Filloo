"use client";

import { BarChart3, Megaphone, MessageCircle, Settings2, ShieldAlert, TrendingUp } from "lucide-react";
import { NavBar, type NavTab } from "@/components/nav/NavBar";

/* Les `match` sont DISJOINTS, comme pour les autres espaces : deux
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
    label: "Modération",
    href: "/admin/moderation",
    icon: ShieldAlert,
    match: (p: string) => p.startsWith("/admin/moderation") || p.startsWith("/admin/signalement"),
  },
  {
    label: "Publicité",
    href: "/admin/publicite",
    icon: TrendingUp,
    match: (p: string) => p.startsWith("/admin/publicite"),
  },
  {
    label: "Statistiques",
    href: "/admin/statistiques",
    icon: BarChart3,
    match: (p: string) => p.startsWith("/admin/statistiques"),
  },
  {
    /* Comptes, produits, équipe, catégories et villes (2026-11-07) :
       tout ce qui se faisait encore dans Supabase. */
    label: "Gestion",
    href: "/admin/gestion",
    icon: Settings2,
    match: (p: string) => p.startsWith("/admin/gestion"),
  },
] as const;

export function AdminNav({ unreadCount = 0 }: { unreadCount?: number }) {
  return <NavBar tabs={TABS} unreadCount={unreadCount} label="Navigation de l'équipe" />;
}
