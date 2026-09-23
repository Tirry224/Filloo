import Image from "next/image";
import { Image as ImageIcon } from "lucide-react";
import { cn } from "@/lib/cn";

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
    hero: "h-75 sm:h-100",     /* 300px, puis 400px dès que la fiche
                                  s'élargit : gardée à 300px sur une
                                  colonne de 640, la photo deviendrait un
                                  bandeau deux fois plus large que haut. */
    free: "",
  } as const;

  /* Ce que le navigateur doit TÉLÉCHARGER, et non ce qu'il affiche. Un
     `100vw` sur un écran de 1440 px ferait chercher une image de 1440 px
     de large pour la poser dans une colonne de 768 — sur une connexion
     guinéenne, c'est un coût réel pour aucun pixel visible. */
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
        <Image
          src={src}
          alt={alt}
          fill
          sizes={SIZES[ratio]}
          priority={priority}
          className="object-cover"
        />
      ) : (
        <>
          <ImageIcon size={iconSize} strokeWidth={1.5} aria-hidden />
          {label ? <span className="text-2xs font-medium">{label}</span> : null}
        </>
      )}
    </div>
  );
}
