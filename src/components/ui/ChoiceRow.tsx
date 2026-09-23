import { Check } from "lucide-react";
import { cn } from "@/lib/cn";

export function ChoiceRow({
  label,
  detail,
  selected = false,
  leading,
  className,
}: {
  label: string;
  detail?: React.ReactNode;
  selected?: boolean;
  leading?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-h-tap items-center gap-3 border-b border-line py-2.5 last:border-b-0",
        className,
      )}
    >
      {leading}
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className={cn("text-base", selected ? "font-semibold" : "font-normal")}>{label}</span>
        {detail}
      </div>
      <span
        aria-hidden
        className={cn(
          "flex size-5.5 shrink-0 items-center justify-center rounded-full border",
          selected ? "border-accent bg-accent text-on-accent" : "border-line",
        )}
      >
        {selected ? <Check size={13} strokeWidth={3} /> : null}
      </span>
    </div>
  );
}
