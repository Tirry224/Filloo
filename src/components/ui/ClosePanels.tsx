"use client";

import { useEffect } from "react";

/**
 * Referme les panneaux de filtre quand on touche ailleurs, ou sur Échap.
 *
 * Un `<details>` ne se referme QUE par son étiquette : toucher à côté ne le
 * ferme pas. C'est le comportement natif, et c'est exactement ce qu'on
 * n'attend pas d'une pop-up sur un téléphone.
 *
 * UN CONFORT, JAMAIS UNE CONDITION : le panneau s'ouvre et se ferme sans
 * JavaScript, par sa puce. Ce fichier ajoute par-dessus ; l'ordre inverse
 * serait la faute, faire dépendre l'ouverture d'un script pas encore
 * chargé.
 *
 * ICI ET PAS DANS `FilterChip`, qui reste un composant serveur : un seul
 * écouteur sur le document coûte moins que trois composants clients par
 * écran, et couvrira les panneaux à venir sans qu'on y repense.
 *
 * `pointerdown` et non `click` : `click` ne se déclenche qu'au relâchement,
 * le panneau resterait ouvert pendant tout l'appui. `pointerdown` couvre le
 * doigt comme la souris, là où `touchstart` oublierait les ordinateurs.
 */
export function ClosePanels() {
  useEffect(() => {
    const fermerSauf = (cible: Node | null) => {
      const ouverts = document.querySelectorAll<HTMLDetailsElement>("details[data-panneau][open]");
      ouverts.forEach((panneau) => {
        /* Le panneau qui contient ce qu'on vient de toucher NE se ferme
           pas : sinon toucher sa propre étiquette le refermerait aussitôt
           rouvert par le navigateur, et choisir une option à l'intérieur
           le fermerait avant que le lien ne parte. */
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
