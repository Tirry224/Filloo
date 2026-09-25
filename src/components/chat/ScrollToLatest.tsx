"use client";

import { useEffect, useRef } from "react";

/** En deçà de cette distance au bas de page, on considère la personne « en bas ». */
const SEUIL_BAS_PX = 120;

function distanceAuBas() {
  const page = document.scrollingElement ?? document.documentElement;
  return page.scrollHeight - page.scrollTop - page.clientHeight;
}

function allerEnBas(behavior: ScrollBehavior) {
  const page = document.scrollingElement ?? document.documentElement;
  window.scrollTo({ top: page.scrollHeight, behavior });
}

/**
 * N'affiche rien : amène la page aux derniers messages.
 *
 * - À l'ouverture du fil, saut immédiat en bas : une messagerie se lit par
 *   la fin. Un `useEffect` passe APRÈS le retour en haut que fait le
 *   routeur à chaque navigation, il a donc le dernier mot.
 * - À l'arrivée d'un message (`lastMessageId` change), défilement doux,
 *   mais seulement si c'est le mien ou si la personne était déjà en bas :
 *   arracher quelqu'un qui relit l'historique serait pire que ne rien faire.
 *
 * Le défilement est celui du DOCUMENT, pas d'un conteneur : `Screen` fait
 * au moins la hauteur de l'écran et le `ScreenFooter` y est collant.
 */
export function ScrollToLatest({ lastMessageId, lastIsMine }: { lastMessageId: string | null; lastIsMine: boolean }) {
  const etaitEnBas = useRef(true);
  const dejaOuvert = useRef(false);

  useEffect(() => {
    const surDefilement = () => {
      etaitEnBas.current = distanceAuBas() <= SEUIL_BAS_PX;
    };
    window.addEventListener("scroll", surDefilement, { passive: true });
    return () => {
      window.removeEventListener("scroll", surDefilement);
      // Si un jour `cacheComponents` garde la page cachée (<Activity>) au
      // lieu de la démonter, les refs survivent : revenir sur le fil doit
      // quand même compter comme une ouverture.
      dejaOuvert.current = false;
    };
  }, []);

  useEffect(() => {
    if (!dejaOuvert.current) {
      dejaOuvert.current = true;
      allerEnBas("instant");
      etaitEnBas.current = true;
      return;
    }
    if (lastIsMine || etaitEnBas.current) allerEnBas("smooth");
  }, [lastMessageId, lastIsMine]);

  return null;
}
