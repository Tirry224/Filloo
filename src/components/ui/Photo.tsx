import { Image as ImageIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import { PhotoImage } from "@/components/ui/PhotoImage";

export function Photo({
  ratio = "square",
  src,
  alt = "",
  label,
  className,
  iconSize = 26,
  priority = false,
}: {
  ratio?: "square" | "card" | "hero" | "free";
  src?: string;
  alt?: string;
  label?: string;
  className?: string;
  iconSize?: number;
  priority?: boolean;
}) {
  const RATIOS = {
    square: "aspect-square",
    card: "h-33",              /* 132px, la vignette du fil */
    hero: "h-75 sm:h-100",     /* 300px, 400px dès 640px */
    free: "",
  } as const;

  const SIZES = {
    square: "(min-width: 48rem) 48rem, 100vw",
    card: "(min-width: 64rem) 15rem, (min-width: 40rem) 33vw, 50vw",
    hero: "(min-width: 48rem) 48rem, 100vw",
    free: "112px",
  } as const;

  return (
    <div
      className={cn(
        "relative flex flex-col items-center justify-center gap-1.5 overflow-hidden bg-placeholder text-ink-soft/60",
        RATIOS[ratio],
        className,
      )}
    >
      {src ? (
        <PhotoImage src={src} alt={alt} sizes={SIZES[ratio]} priority={priority} iconSize={iconSize} />
      ) : (
        <>
          <ImageIcon size={iconSize} strokeWidth={1.5} aria-hidden />
          {label ? <span className="text-2xs font-medium">{label}</span> : null}
        </>
      )}
    </div>
  );
}
