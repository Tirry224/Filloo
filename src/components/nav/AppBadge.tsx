"use client";

import { useEffect } from "react";

/**
 * Le nombre de messages non lus sur l'ICÔNE de l'application installée
 * (API Badging). Il additionne les deux espaces : l'icône est une seule,
 * quel que soit l'espace ouvert.
 *
 * Application fermée, c'est `public/sw.js` qui allume le badge à l'arrivée
 * d'un push ; ce composant le remet au nombre exact dès qu'un écran à
 * onglets s'affiche.
 *
 * Support inégal, et rien à y faire ici : Chrome et Edge sur ordinateur,
 * Safari sur iPhone (application ajoutée à l'écran d'accueil, notifications
 * acceptées). Sur Android, c'est le lanceur qui dessine la pastille, à
 * partir des notifications affichées — pas de cette API.
 */
export function AppBadge({ count }: { count: number }) {
  useEffect(() => {
    if (!("setAppBadge" in navigator)) return;
    const pose = count > 0 ? navigator.setAppBadge(count) : navigator.clearAppBadge();
    // Refusé (permission absente, application non installée) : sans effet visible, rien à dire.
    pose.catch(() => {});
  }, [count]);

  return null;
}
