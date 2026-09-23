"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

export type NavTab = {
  label: string;
  href: string;
  icon: LucideIcon;
  match: (pathname: string) => boolean;
};

/**
 * L'ORDRE DU DOM ne change pas d'une forme à l'autre : la barre reste
 * APRÈS le contenu, et c'est `order` qui la place à gauche, pour que le
 * clavier traverse le contenu avant la navigation.
 */
export function NavBar({
  tabs,
  unreadCount = 0,
  label,
}: {
  tabs: readonly NavTab[];
  unreadCount?: number;
  label: string;
}) {
  const pathname = usePathname();

  return (
    <nav
      aria-label={label}
      className={cn(
        "sticky bottom-0 flex shrink-0 border-t border-line bg-surface",
        "lg:top-0 lg:bottom-auto lg:h-dvh lg:w-rail lg:flex-col lg:gap-1",
        "lg:border-t-0 lg:border-r lg:p-3 lg:pt-5",
        "lg:order-first",
      )}
    >
      {tabs.map(({ label: tabLabel, href, icon: Icon, match }) => {
        const isActive = match(pathname);
        const badge = tabLabel === "Messages" && unreadCount > 0 ? unreadCount : 0;
        return (
          <Link
            key={tabLabel}
            href={href}
            aria-current={isActive ? "page" : undefined}
            aria-label={badge > 0 ? `${tabLabel}, ${badge} non lus` : undefined}
            className={cn(
              "flex h-nav flex-1 flex-col items-center justify-center gap-0.5 text-2xs",
              "lg:h-auto lg:w-full lg:flex-none lg:flex-row lg:justify-start lg:gap-3 lg:rounded-lg lg:px-3 lg:py-2.5 lg:text-sm",
              isActive
                ? "font-semibold text-accent lg:bg-accent-soft"
                : "font-medium text-ink-soft lg:hover:bg-paper",
            )}
          >
            <span className="relative">
              <Icon size={22} strokeWidth={isActive ? 2 : 1.8} aria-hidden />
              {badge > 0 ? (
                <span
                  aria-hidden
                  className="absolute -top-1 -right-2 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-accent px-1 text-2xs font-bold text-on-accent lg:hidden"
                >
                  {badge > 9 ? "9+" : badge}
                </span>
              ) : null}
            </span>
            {tabLabel}
            {badge > 0 ? (
              <span
                aria-hidden
                className="ml-auto hidden h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1.5 text-2xs font-bold text-on-accent lg:flex"
              >
                {badge > 99 ? "99+" : badge}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
