"use client";

import { useEffect } from "react";

/**
 * Referme les panneaux de filtre quand on touche ailleurs, ou sur Échap :
 * un `<details>` ne se referme nativement que par son étiquette, l'inverse
 * de ce qu'on attend d'une pop-up sur un téléphone.
 *
 * Un CONFORT, jamais une condition : le panneau s'ouvre et se ferme sans
 * JavaScript, par sa puce.
 *
 * Ici et non dans `FilterChip`, qui reste un composant serveur : un seul
 * écouteur sur le document coûte moins que trois composants clients par
 * écran.
 *
 * `pointerdown` et non `click`, qui n'arrive qu'au relâchement ; et non
 * `touchstart`, qui oublierait les ordinateurs.
 */
export function ClosePanels() {
  useEffect(() => {
    const fermerSauf = (cible: Node | null) => {
      const ouverts = document.querySelectorAll<HTMLDetailsElement>("details[data-panneau][open]");
      ouverts.forEach((panneau) => {
        /* Le panneau contenant ce qu'on vient de toucher NE se ferme pas :
           sinon son étiquette le refermerait aussitôt rouvert, et choisir
           une option le fermerait avant que le lien ne parte. */
        if (cible && panneau.contains(cible)) return;
        panneau.open = false;
      });
    };

    const surTap = (evenement: PointerEvent) => {
      fermerSauf(evenement.target instanceof Node ? evenement.target : null);
    };
    const surTouche = (evenement: KeyboardEvent) => {
      if (evenement.key === "Escape") fermerSauf(null);
    };

    document.addEventListener("pointerdown", surTap);
    document.addEventListener("keydown", surTouche);
    return () => {
      document.removeEventListener("pointerdown", surTap);
      document.removeEventListener("keydown", surTouche);
    };
  }, []);

  return null;
}
