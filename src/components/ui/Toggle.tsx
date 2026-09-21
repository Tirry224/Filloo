import { cn } from "@/lib/cn";

/**
 * Interrupteur. `role="switch"` et `aria-checked` le rendent
 * compréhensible : sans eux, un lecteur d'écran annonce « bouton » sans
 * dire si l'option est active — la couleur seule ne parle qu'aux voyants.
 *
 * `onClick` est optionnel, pour un écran pas encore branché.
 */
export function Toggle({
  checked,
  label,
  onClick,
  className,
}: {
  checked: boolean;
  label: string;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={onClick}
      className={cn(
        "flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full p-0.5 transition-colors",
        checked ? "justify-end bg-accent" : "justify-start bg-line",
        className,
      )}
    >
      <span className="size-6 rounded-full bg-surface" />
    </button>
  );
}
