import { cn } from "@/lib/cn";

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
