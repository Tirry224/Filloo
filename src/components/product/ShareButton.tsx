"use client";

import { useState } from "react";
import { Check, Share2 } from "lucide-react";
import { partagerProduit } from "@/lib/partage";

/** Le bouton Partager de la fiche produit côté client : voir `partagerProduit`. */
export function ShareButton({
  productId,
  title,
  price,
  shopName,
}: {
  productId: string;
  title: string;
  price: string;
  shopName: string;
}) {
  const [copie, setCopie] = useState(false);

  async function partager() {
    if ((await partagerProduit({ productId, title, price, shopName })) === "copie") {
      setCopie(true);
      setTimeout(() => setCopie(false), 2000);
    }
  }

  return (
    <button
      type="button"
      onClick={partager}
      aria-label={copie ? "Lien copié" : "Partager ce produit"}
      className="absolute top-3.5 right-3.5 flex size-10 items-center justify-center rounded-full border border-line-strong bg-surface"
    >
      {copie ? (
        <Check size={20} strokeWidth={2.75} aria-hidden className="text-success" />
      ) : (
        <Share2 size={20} strokeWidth={2.5} aria-hidden className="text-black" />
      )}
    </button>
  );
}
