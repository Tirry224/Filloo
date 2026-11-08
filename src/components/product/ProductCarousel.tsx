"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { Photo } from "@/components/ui/Photo";
import { cn } from "@/lib/cn";

const STYLES = {
  track:
    "flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
  slide: "w-full shrink-0 snap-center",
  dots: "absolute inset-x-0 bottom-tight flex justify-center",
  dot: "flex cursor-pointer p-hair",
  pip: "size-tight rounded-full bg-surface/55 shadow-sheet transition-colors",
  pipActive: "bg-surface",
} as const;

export function ProductCarousel({
  productId,
  imageUrls,
  title,
  sold,
}: {
  productId: string;
  imageUrls: string[];
  title: string;
  sold: boolean;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [current, setCurrent] = useState(0);
  /* Les photos ne partent qu'à la demande : à l'ouverture, seule la
     première ; dès que le doigt touche le carrousel, la suivante. Avant,
     toutes étaient `lazy` mais voisines de l'écran, et Chrome les prenait
     quand même — d'autant plus loin que le réseau est lent : 267 Ko de
     photos en 3G contre 169 Ko en 4G sur une fiche (mesuré le 2026-11-08). */
  const [jusqua, setJusqua] = useState(0);
  const demander = (index: number) => setJusqua((j) => Math.max(j, Math.min(index, imageUrls.length - 1)));

  if (imageUrls.length <= 1) {
    const photo = (
      <Photo ratio="hero" src={imageUrls[0]} alt={title} priority className={sold ? "grayscale" : ""} />
    );
    return imageUrls.length === 1 ? (
      <Link href={`/produit/${productId}/photos`} aria-label="Voir la photo en grand">
        {photo}
      </Link>
    ) : (
      photo
    );
  }

  function handleScroll() {
    const track = trackRef.current;
    if (!track) return;
    const index = Math.round(track.scrollLeft / track.clientWidth);
    if (index !== current) setCurrent(index);
    demander(index + 1);
  }

  function goTo(index: number) {
    demander(index + 1);
    const track = trackRef.current;
    track?.scrollTo({ left: index * track.clientWidth, behavior: "smooth" });
  }

  return (
    <div className="relative" role="region" aria-roledescription="carrousel" aria-label="Photos du produit">
      <div
        ref={trackRef}
        onScroll={handleScroll}
        onPointerDown={() => demander(current + 1)}
        className={STYLES.track}
      >
        {imageUrls.map((url, i) => (
          <Link
            key={url}
            href={`/produit/${productId}/photos?photo=${i + 1}`}
            aria-label={`Photo ${i + 1} sur ${imageUrls.length}, voir en grand`}
            className={STYLES.slide}
          >
            <Photo
              ratio="hero"
              src={i <= jusqua ? url : undefined}
              alt={i === 0 ? title : ""}
              priority={i === 0}
              className={sold ? "grayscale" : ""}
            />
          </Link>
        ))}
      </div>
      <div className={STYLES.dots}>
        {imageUrls.map((url, i) => (
          <button
            key={url}
            type="button"
            onClick={() => goTo(i)}
            aria-label={`Afficher la photo ${i + 1}`}
            aria-current={i === current}
            className={STYLES.dot}
          >
            <span className={cn(STYLES.pip, i === current && STYLES.pipActive)} />
          </button>
        ))}
      </div>
    </div>
  );
}
