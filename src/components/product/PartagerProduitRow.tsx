"use client";

import { useState } from "react";
import { Check, Share2 } from "lucide-react";
import { ActionRow } from "@/components/ui/ActionRow";
import { partagerProduit } from "@/lib/partage";

/**
 * « Partager » dans la feuille d'actions du commerçant : même lien et même
 * message que `ShareButton` de la fiche client, pour que l'aperçu WhatsApp
 * soit celui qu'un client verrait. Sur ordinateur, le lien est copié et
 * la ligne le dit deux secondes.
 */
export function PartagerProduitRow(produit: { productId: string; title: string; price: string; shopName: string }) {
  const [copie, setCopie] = useState(false);

  async function partager() {
    if ((await partagerProduit(produit)) === "copie") {
      setCopie(true);
      setTimeout(() => setCopie(false), 2000);
    }
  }

  return (
    <ActionRow
      icon={copie ? Check : Share2}
      label={copie ? "Lien copié" : "Partager"}
      description="WhatsApp, Facebook, SMS : le lien montre la photo, le nom et le prix."
      onClick={partager}
    />
  );
}
