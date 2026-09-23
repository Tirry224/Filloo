"use client";

import { House, MessageCircle, Search, User } from "lucide-react";
import { NavBar, type NavTab } from "@/components/nav/NavBar";

const TABS: readonly NavTab[] = [
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
  return <NavBar tabs={TABS} unreadCount={unreadCount} label="Navigation principale" />;
}
