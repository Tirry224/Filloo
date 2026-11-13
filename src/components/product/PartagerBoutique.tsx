"use client";

import { useState } from "react";
import { Check, Share2 } from "lucide-react";
import { ActionRow } from "@/components/ui/ActionRow";
import { partagerBoutique } from "@/lib/partage";

type Boutique = { merchantId: string; shopName: string; city: string };

function usePartage(boutique: Boutique) {
  const [copie, setCopie] = useState(false);
  async function partager() {
    if ((await partagerBoutique(boutique)) === "copie") {
      setCopie(true);
      setTimeout(() => setCopie(false), 2000);
    }
  }
  return { copie, partager };
}

/** Le bouton rond de l'en-tête de la page boutique (client, visiteur ou commerçant). */
export function PartagerBoutiqueButton(boutique: Boutique) {
  const { copie, partager } = usePartage(boutique);
  return (
    <button
      type="button"
      onClick={partager}
      aria-label={copie ? "Lien copié" : "Partager cette boutique"}
      className="flex size-10 items-center justify-center rounded-full border border-line-strong bg-surface"
    >
      {copie ? (
        <Check size={20} strokeWidth={2.75} aria-hidden className="text-success" />
      ) : (
        <Share2 size={20} strokeWidth={2.5} aria-hidden className="text-black" />
      )}
    </button>
  );
}

/** La ligne « Partager ma boutique » de l'espace commerçant. */
export function PartagerBoutiqueRow(boutique: Boutique) {
  const { copie, partager } = usePartage(boutique);
  return (
    <ActionRow
      icon={copie ? Check : Share2}
      label={copie ? "Lien copié" : "Partager ma boutique"}
      description="WhatsApp, Facebook, SMS : le lien montre la photo, le nom et la ville."
      onClick={partager}
    />
  );
}
