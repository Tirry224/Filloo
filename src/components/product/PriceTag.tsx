import { cn } from "@/lib/cn";
import { formatGnf } from "@/lib/format";

export function PriceTag({
  amount,
  size = "md",
  struck = false,
  className,
}: {
  amount: number;
  size?: "sm" | "md" | "lg";
  struck?: boolean;
  className?: string;
}) {
  const SIZES = { sm: "text-sm", md: "text-base", lg: "text-3xl" } as const;
  return (
    <span
      className={cn(
        "font-display font-bold tracking-tight",
        SIZES[size],
        struck && "text-ink-soft line-through",
        className,
      )}
    >
      {formatGnf(amount)}
    </span>
  );
}
