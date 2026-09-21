import Link from "next/link";
import { cn } from "@/lib/cn";
import type { LucideIcon } from "lucide-react";

/**
 * Filtre ou catégorie sélectionnable : « Conakry », « Alimentation ».
 *
 * Comme pour `Button`, `href` produit un LIEN et son absence un simple
 * libellé : les filtres de Makiti vivant dans l'URL, une puce qui filtre
 * EST un lien — elle se partage, et « retour » la défait. Une puce sans
 * `href` ne filtre rien, elle affiche un état.
 */
export function Chip({
  children,
  selected = false,
  icon: Icon,
  href,
  className,
}: {
  children: React.ReactNode;
  selected?: boolean;
  icon?: LucideIcon;
  href?: string;
  className?: string;
}) {
  const classes = cn(
    // `whitespace-nowrap` : dans une rangée qui défile, une puce qui se
    // replie casse l'alignement de toute la rangée.
    "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-2 text-sm font-medium",
    selected ? "border-ink bg-ink text-paper" : "border-line bg-surface text-ink",
    className,
  );

  const content = (
    <>
      {Icon ? <Icon size={15} strokeWidth={1.8} aria-hidden /> : null}
      {children}
    </>
  );

  if (href) {
    return (
      <Link href={href} className={classes}>
        {content}
      </Link>
    );
  }

  return <span className={classes}>{content}</span>;
}
