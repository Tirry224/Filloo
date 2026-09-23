"use client";

import { House, MessageCircle, Search, User } from "lucide-react";
import { NavBar, type NavTab } from "@/components/nav/NavBar";

/**
 * La barre d'onglets de l'espace CLIENT — et elle ne sert que lui.
 *
 * Deux composants plutôt qu'un avec une prop `space` : une prop a une
 * valeur par défaut, donc un écran qui l'oublie affiche la mauvaise barre
 * sans que la relecture le voie. Ici c'est le LAYOUT qui rend l'une ou
 * l'autre, et un écran de `(client)` n'a aucun moyen de demander celle du
 * commerçant (décision 8 de docs/SPEC.md).
 *
 * Le DESSIN de la barre — horizontale en bas sur téléphone, latérale sur
 * grand écran — vit dans `NavBar`, partagé avec le commerçant. Ce
 * fichier-ci ne décide que d'une chose : QUELS onglets. C'est
 * précisément ce que la décision 8 protège.
 */
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
