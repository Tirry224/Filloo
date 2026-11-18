"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { META_PIXEL_ID, initialiserPixel, pixelInscriptionEnAttente, pixelPageVue } from "@/lib/meta-pixel";

/**
 * Charge le Meta Pixel et envoie une `PageView` à chaque changement de
 * page (la navigation de Next ne recharge pas la page, Meta ne la verrait
 * pas seule). Puis envoie `CompleteRegistration` si une inscription vient
 * d'aboutir — voir `COOKIE_INSCRIPTION`.
 *
 * L'espace admin n'est pas mesuré : il n'a rien à voir avec une pub.
 */
export function MetaPixel() {
  const chemin = usePathname();
  useEffect(() => {
    if (!META_PIXEL_ID || chemin.startsWith("/admin")) return;
    initialiserPixel();
    pixelPageVue();
    pixelInscriptionEnAttente();
  }, [chemin]);
  return null;
}
