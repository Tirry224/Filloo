import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Card } from "./Card";
import { cn } from "@/lib/cn";

/**
 * Liste de réglages : une icône, un intitulé, éventuellement une valeur.
 *
 * Le séparateur est posé par `last:border-b-0` plutôt qu'en calculant
 * l'index de la dernière ligne : le composant reste indifférent au nombre
 * d'éléments et à leur ordre.
 */
export function MenuList({ children }: { children: React.ReactNode }) {
  return <Card className="px-3.5">{children}</Card>;
}

export function MenuItem({
  icon: Icon,
  label,
  value,
  href,
  action,
  tone = "default",
}: {
  icon: LucideIcon;
  label: string;
  value?: string;
  href?: string;
  /** Action serveur (ex. déconnexion) — rend sa propre petite `<form>`. */
  action?: () => void | Promise<void>;
  tone?: "default" | "danger";
}) {
  const content = (
    <>
      <Icon size={20} strokeWidth={1.8} aria-hidden className="shrink-0" />
      <span className="flex-1 text-base">{label}</span>
      {value ? <span className="text-sm text-ink-soft">{value}</span> : null}
      {href ? (
        <ChevronRight size={18} strokeWidth={2} aria-hidden className="shrink-0 text-ink-soft" />
      ) : null}
    </>
  );

  const className = cn(
    "flex h-tap items-center gap-3.5 border-b border-line last:border-b-0",
    tone === "danger" ? "text-danger" : "text-ink",
  );

  /* Un élément qui navigue est un lien, un élément qui agit est un bouton
     dans sa propre `<form>`. On ne met pas un `onClick` sur un `<div>` :
     ni le clavier ni un lecteur d'écran ne sauraient s'en servir. */
  if (href) {
    return (
      <Link href={href} className={className}>
        {content}
      </Link>
    );
  }
  if (action) {
    return (
      <form action={action}>
        <button type="submit" className={cn(className, "w-full cursor-pointer text-left")}>
          {content}
        </button>
      </form>
    );
  }
  /* Ni lien ni action : une ligne d'information, pas un bouton. Elle en
     rendait un, `cursor-pointer` compris — on touche, rien ne se passe, on
     croit l'application bloquée. */
  return <div className={cn(className, "text-ink-soft")}>{content}</div>;
}

/**
 * Une ligne de réglage qui n'emmène nulle part : elle OUVRE un panneau.
 *
 * PAS DE CHEVRON : il promettrait un changement d'écran alors que le
 * panneau remonte du bas — le « retour » du téléphone ne ramènerait pas
 * où la personne croit.
 *
 * UN PANNEAU ET PAS UNE PAGE : l'aller-retour dure quelques secondes et
 * doit laisser exactement où l'on était, quand une page dédiée coûterait
 * un écran de plus dans `docs/ECRANS.md` pour trois champs.
 *
 * Même mécanique que les filtres : un `<details>`, donc sans JavaScript,
 * que `data-panneau` fait refermer par `ClosePanels`.
 */
export function MenuPanel({
  icon: Icon,
  label,
  title,
  children,
}: {
  icon: LucideIcon;
  label: string;
  /** Le titre du panneau ouvert — la ligne n'est plus visible à ce moment-là. */
  title: string;
  children: React.ReactNode;
}) {
  return (
    <details data-panneau>
      <summary className="flex h-tap cursor-pointer list-none items-center gap-3.5 border-b border-line text-base text-ink last:border-b-0 [&::-webkit-details-marker]:hidden">
        <Icon size={20} strokeWidth={1.8} aria-hidden className="shrink-0" />
        <span className="flex-1">{label}</span>
      </summary>

      {/* `fixed` : la carte qui contient cette liste a ses propres marges
          et son propre arrondi ; un panneau posé dedans en hériterait.
          `z-20` pour passer devant la barre de navigation du bas, qui ne
          déclare aucun plan. */}
      <div className="fixed inset-x-0 bottom-0 z-20 mx-auto flex max-h-[85vh] w-full max-w-app flex-col rounded-t-2xl border-t border-line bg-surface shadow-sheet">
        <p className="shrink-0 px-4.5 pt-3.5 pb-1 text-base font-bold">{title}</p>
        <div className="overflow-y-auto px-4.5 pt-3 pb-5">{children}</div>
      </div>
    </details>
  );
}
