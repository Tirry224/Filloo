import Link from "next/link";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";
import type { LucideIcon } from "lucide-react";

export type FilterOption = {
  label: string;
  href: string;
  selected?: boolean;
};

export function FilterChip({
  title,
  label,
  selected = false,
  icon: Icon,
  options,
}: {
  title: string;
  label: string;
  selected?: boolean;
  icon?: LucideIcon;
  options: FilterOption[];
}) {
  return (
    <details data-panneau className="group">
      <summary
        className={cn(
          // `list-none` et le pseudo-élément WebKit retirent le triangle
          // par défaut, absent du design system ; le chevron le remplace.
          "inline-flex shrink-0 cursor-pointer list-none items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-2 text-sm font-medium [&::-webkit-details-marker]:hidden",
          selected ? "border-ink bg-ink text-paper" : "border-line bg-surface text-ink",
        )}
      >
        {Icon ? <Icon size={15} strokeWidth={1.8} aria-hidden /> : null}
        {label}
        <ChevronDown size={15} strokeWidth={2} className="group-open:rotate-180" aria-hidden />
      </summary>

      <div className="fixed inset-x-0 bottom-0 z-20 mx-auto flex max-h-[55vh] w-full max-w-app flex-col rounded-t-2xl border-t border-line bg-surface shadow-sheet">
        <p className="shrink-0 px-4.5 pt-3.5 pb-2 text-sm font-bold">{title}</p>
        <div className="overflow-y-auto px-2.5 pb-5">
          {options.map((option) => (
            <Link
              key={option.href}
              href={option.href}
              className="flex items-center justify-between gap-3 rounded-xl px-2 py-3 text-base"
            >
              <span className={option.selected ? "font-semibold text-accent" : "text-ink"}>{option.label}</span>
              {option.selected ? (
                <Check size={18} strokeWidth={2.4} className="shrink-0 text-accent" aria-hidden />
              ) : null}
            </Link>
          ))}
        </div>
      </div>
    </details>
  );
}
