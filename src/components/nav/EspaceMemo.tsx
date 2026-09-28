"use client";

import { useEffect } from "react";
import { ESPACE_COOKIE, type Espace } from "@/lib/espace";

/**
 * Retient l'espace réellement AFFICHÉ, pour que l'application rouvre là où
 * on l'a quittée (`landingForSession`). Monté par les layouts à onglets et
 * non posé au bord : un préchargement de lien vers l'autre espace ne doit
 * pas suffire à basculer.
 */
export function EspaceMemo({ espace }: { espace: Espace }) {
  useEffect(() => {
    document.cookie = `${ESPACE_COOKIE}=${espace}; path=/; max-age=31536000; samesite=lax`;
  }, [espace]);

  return null;
}
