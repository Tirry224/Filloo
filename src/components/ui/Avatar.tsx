import { Package } from "lucide-react";
import { cn } from "@/lib/cn";
import { PhotoImage } from "@/components/ui/PhotoImage";

/**
 * `src` : la photo, si la personne ou la boutique en a une. Sans elle —
 * ou si elle ne se charge pas (`PhotoImage`) —, les initiales ou l'icône.
 */
export function Avatar({
  name,
  kind = "person",
  size = 44,
  src,
  className,
}: {
  name: string;
  kind?: "person" | "shop";
  size?: number;
  src?: string | null;
  className?: string;
}) {
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <div
      style={{ width: size, height: size }}
      aria-hidden
      className={cn(
        "relative flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-placeholder",
        "font-display font-bold text-ink-soft",
        className,
      )}
    >
      {src ? (
        <PhotoImage src={src} alt="" sizes={`${size}px`} priority={false} iconSize={size * 0.44} />
      ) : kind === "shop" ? (
        <Package size={size * 0.44} strokeWidth={1.6} />
      ) : (
        <span style={{ fontSize: size * 0.34 }}>{initials}</span>
      )}
    </div>
  );
}
