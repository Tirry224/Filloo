import type { LucideIcon } from "lucide-react";

/**
 * État vide. Sa signature impose qu'un écran vide explique POURQUOI il
 * l'est (`title`, `description`) et propose une SORTIE (`children`) : une
 * page blanche paraît cassée, pas vide.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-7 py-8 text-center">
      <div className="flex size-16 items-center justify-center rounded-2xl bg-accent-soft text-accent">
        <Icon size={30} strokeWidth={1.7} aria-hidden />
      </div>
      <h2 className="text-xl font-bold">{title}</h2>
      <p className="text-base leading-relaxed text-ink-soft">{description}</p>
      {children ? <div className="flex w-full flex-col gap-2 pt-1">{children}</div> : null}
    </div>
  );
}
