import Link from "next/link";
import { cn } from "@/lib/cn";
import type { LucideIcon } from "lucide-react";

type BaseProps = {
  icon: LucideIcon;
  label: string;
  description: string;
  tone?: "default" | "danger";
};

/**
 * Ligne d'action dans une feuille : un intitulé, sa conséquence en dessous.
 *
 * Trois formes selon ce qu'on lui donne — jamais un `onClick`, on est dans
 * un composant serveur :
 * - `href` : une navigation → un `<Link>`.
 * - `action` + `hiddenFields` : une action serveur → sa propre `<form>`,
 *   une par ligne, pour que chaque bouton ne fasse qu'une chose plutôt que
 *   de fondre la feuille en un formulaire unique.
 * - ni l'un ni l'autre : un bouton inerte, pour les écrans pas encore
 *   branchés (voir docs/MEMOIRE.md).
 */
type ActionRowProps =
  | (BaseProps & { href: string; action?: undefined; hiddenFields?: undefined })
  | (BaseProps & {
      href?: undefined;
      action: (formData: FormData) => void | Promise<void>;
      hiddenFields?: Record<string, string>;
    })
  | (BaseProps & { href?: undefined; action?: undefined; hiddenFields?: undefined });

export function ActionRow(props: ActionRowProps) {
  const { icon: Icon, label, description, tone = "default" } = props;

  const classes = cn(
    "flex w-full cursor-pointer items-start gap-3.5 border-b border-line py-3.5 text-left last:border-b-0",
    tone === "danger" ? "text-danger" : "text-ink",
  );

  const content = (
    <>
      <Icon size={20} strokeWidth={1.8} aria-hidden className="mt-px shrink-0" />
      <span className="flex flex-col gap-0.5">
        <span className="text-base font-semibold">{label}</span>
        {/* La conséquence est écrite sous chaque action : « Masquer » et
            « Supprimer » se ressemblent, pas leur effet sur les données. */}
        <span className="text-xs leading-normal text-ink-soft">{description}</span>
      </span>
    </>
  );

  if (props.href) {
    return (
      <Link href={props.href} className={classes}>
        {content}
      </Link>
    );
  }

  if (props.action) {
    return (
      <form action={props.action}>
        {Object.entries(props.hiddenFields ?? {}).map(([name, value]) => (
          <input key={name} type="hidden" name={name} value={value} />
        ))}
        <button type="submit" className={classes}>
          {content}
        </button>
      </form>
    );
  }

  return (
    <button type="button" className={classes}>
      {content}
    </button>
  );
}
