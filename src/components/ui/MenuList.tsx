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
  /* Ni lien ni action : ce n'est pas un bouton, c'est une ligne
     d'information. Elle en rendait un quand même — `cursor-pointer`
     compris — et « Conditions d'utilisation » était donc, sur `/compte`
     comme sur `/vendeur/boutique`, un bouton qu'on touche et qui ne fait
     rien. On réessaie, on croit l'application bloquée : exactement le
     défaut déjà rencontré avec l'onglet « Accueil » mort du commerçant
     (docs/REPRISE.md, section 5).

     C'est « Conditions d'utilisation » qui avait révélé ce défaut, le
     temps que son texte existe ; depuis le 2026-09-17 elle porte un
     `href` et redevient un vrai lien. Cette branche reste, parce que la
     règle qu'elle défend ne dépendait pas de ce cas : une ligne sans
     destination ni action doit se présenter comme une information, pas
     comme un bouton mort. */
  return <div className={cn(className, "text-ink-soft")}>{content}</div>;
}

/**
 * Une ligne de réglage qui n'emmène nulle part : elle OUVRE un panneau.
 *
 * POURQUOI PAS DE CHEVRON
 * Dans cette liste, le chevron promet un départ — « tu vas changer
 * d'écran ». Ici on ne part pas : un panneau remonte du bas et l'écran
 * reste dessous. Mettre le chevron quand même, c'est annoncer un geste
 * qui n'aura pas lieu, et le bouton « retour » du téléphone ne ramènera
 * pas là où la personne croit.
 *
 * POURQUOI UN PANNEAU ET PAS UNE PAGE
 * Changer son mot de passe est un aller-retour de quelques secondes,
 * après lequel on veut se retrouver exactement où l'on était. Une page
 * dédiée ferait sortir de l'écran de compte pour y revenir — et
 * `docs/ECRANS.md` compterait un écran de plus pour trois champs.
 *
 * Même mécanique que les panneaux de filtre : un `<details>`, donc il
 * s'ouvre sans JavaScript, et `data-panneau` le fait refermer par
 * `ClosePanels` quand on touche à côté.
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
