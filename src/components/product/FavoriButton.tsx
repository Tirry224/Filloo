"use client";

import { useState, useTransition } from "react";
import { Heart } from "lucide-react";
import { definirFavoriAction } from "@/lib/actions/favoris";
import { cn } from "@/lib/cn";

/**
 * Le cœur de la page boutique, pour un client connecté. Il change tout
 * de suite ; si la base refuse, il revient et l'erreur s'affiche dessous.
 */
export function FavoriButton({ merchantId, initial }: { merchantId: string; initial: boolean }) {
  const [favori, setFavori] = useState(initial);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, startTransition] = useTransition();

  function basculer() {
    const voulu = !favori;
    setFavori(voulu);
    setErreur(null);
    startTransition(async () => {
      const etat = await definirFavoriAction(merchantId, voulu);
      setFavori(etat.favori);
      if (etat.error) setErreur(etat.error);
    });
  }

  return (
    <span className="relative">
      <button
        type="button"
        onClick={basculer}
        disabled={enCours}
        aria-pressed={favori}
        aria-label={favori ? "Retirer des favoris" : "Ajouter aux favoris"}
        className="flex size-10 items-center justify-center rounded-full border border-line-strong bg-surface"
      >
        <Heart
          size={20}
          strokeWidth={2.5}
          aria-hidden
          className={cn(favori ? "fill-danger text-danger" : "text-black")}
        />
      </button>
      {erreur ? (
        <span role="alert" className="absolute top-full right-0 z-10 mt-1 w-48 text-right text-2xs text-danger">
          {erreur}
        </span>
      ) : null}
    </span>
  );
}
