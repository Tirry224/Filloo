"use client";

import { useState } from "react";
import { Check, Share2 } from "lucide-react";

/**
 * Partage le lien de la page produit. La photo, le nom et le prix de
 * l'aperçu (WhatsApp, Facebook, SMS) viennent des balises Open Graph de
 * `generateMetadata` ; le nom de la boutique est dans le texte, l'aperçu
 * ne le montre que pour un produit sans description. Même message que
 * le bouton Partager de l'app mobile.
 *
 * Sans `navigator.share` (la plupart des ordinateurs), le lien est copié.
 */
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
    // L'origine et non `location.href` : l'adresse peut porter `?info=`.
    const url = `${window.location.origin}/produit/${productId}`;
    const text = `${title}, ${price}, chez ${shopName} sur Filloo :`;
    if (navigator.share) {
      try {
        await navigator.share({ text, url });
      } catch {
        // Fermer la feuille de partage lève une erreur : ce n'est pas une panne.
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(`${text}\n${url}`);
      setCopie(true);
      setTimeout(() => setCopie(false), 2000);
    } catch {
      window.prompt("Copiez ce lien :", url);
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
