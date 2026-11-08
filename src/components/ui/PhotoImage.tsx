"use client";

import { useState } from "react";
import Image from "next/image";
import { Image as ImageIcon } from "lucide-react";

export function PhotoImage({
  src,
  alt,
  sizes,
  priority,
  iconSize,
}: {
  src: string;
  alt: string;
  sizes: string;
  priority: boolean;
  iconSize: number;
}) {
  const [failed, setFailed] = useState(false);
  if (failed) return <ImageIcon size={iconSize} strokeWidth={1.5} aria-hidden />;
  /* Une photo prioritaire part tout de suite ET en tête de file (R2 bis).
     Depuis Next 16, `priority` ne fait plus que précharger : sans
     `fetchPriority`, le navigateur la classait « basse », derrière la
     police et les scripts. Mesuré le 2026-11-08 (3G lente) : demandée à
     2,1 s, reçue à 6,1 s, après la police. La documentation de Next
     conseille `loading="eager"` + `fetchPriority="high"` plutôt que
     `preload`, qu'on ne combine pas avec eux. */
  return (
    <Image
      src={src}
      alt={alt}
      fill
      sizes={sizes}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : "auto"}
      className="object-cover"
      onError={() => setFailed(true)}
    />
  );
}
