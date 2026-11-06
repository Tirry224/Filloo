"use client";

import { useEffect } from "react";
import { COOKIE_GOUTS, DUREE_GOUTS_S, ecrireGouts, lireGouts, nourrirGouts } from "@/lib/gouts";

function lireCookie(nom: string): string | undefined {
  return document.cookie
    .split("; ")
    .find((c) => c.startsWith(`${nom}=`))
    ?.slice(nom.length + 1);
}

/**
 * Retient, sur CET appareil, qu'une catégorie ou une boutique a été
 * regardée (`gouts.ts`). Écrit par le navigateur : une page serveur ne peut
 * pas poser de cookie pendant son rendu. Rien n'est envoyé à Filloo
 * autrement qu'avec les pages suivantes, qui s'en servent pour leur ordre.
 */
export function RetenirGout({ categorie, boutique }: { categorie?: string | null; boutique?: string | null }) {
  useEffect(() => {
    try {
      const gouts = nourrirGouts(lireGouts(lireCookie(COOKIE_GOUTS)), { categorie, boutique });
      document.cookie = `${COOKIE_GOUTS}=${ecrireGouts(gouts)}; Max-Age=${DUREE_GOUTS_S}; Path=/; SameSite=Lax${
        location.protocol === "https:" ? "; Secure" : ""
      }`;
    } catch {
      // Cookies bloqués : l'accueil reste simplement mélangé sans préférence.
    }
  }, [categorie, boutique]);
  return null;
}
