"use client";

import { useEffect } from "react";

/**
 * Referme les panneaux de filtre quand on touche ailleurs, ou sur Échap.
 *
 * POURQUOI CE FICHIER EXISTE
 * Les panneaux de `FilterChip` sont des `<details>`, et un `<details>` ne
 * se referme QUE par sa propre étiquette : toucher à côté ne le ferme pas.
 * C'est le comportement natif, et c'est exactement ce qu'un utilisateur ne
 * s'attend pas à trouver — on touche à côté d'une pop-up pour la fermer,
 * partout ailleurs sur un téléphone. Constaté à l'usage le 2026-09-19.
 *
 * POURQUOI UNE AMÉLIORATION, ET NON UNE RÉÉCRITURE
 * Le panneau continue de s'ouvrir et de se fermer SANS JavaScript, par sa
 * puce : c'est le socle, et il ne bouge pas (`docs/PERFORMANCE.md`,
 * règle R3). Ce fichier n'ajoute qu'un confort par-dessus. Si le
 * JavaScript n'est pas encore chargé — les longues secondes d'une
 * connexion guinéenne — l'application reste utilisable, simplement moins
 * confortable. C'est l'ordre inverse qui serait une faute : faire dépendre
 * l'ouverture du panneau d'un script qui n'est pas là.
 *
 * POURQUOI ICI ET PAS DANS `FilterChip`
 * `FilterChip` reste un composant serveur : il n'envoie aucun JavaScript
 * au navigateur, et il y en a jusqu'à trois par écran. Un seul écouteur
 * posé une fois sur le document coûte moins que trois composants clients,
 * et il couvrira les panneaux à venir sans qu'on y repense.
 *
 * POURQUOI `pointerdown` ET PAS `click`
 * `click` ne se déclenche qu'au relâchement du doigt : le panneau resterait
 * ouvert pendant tout l'appui, ce qui se voit. `pointerdown` couvre aussi
 * bien le doigt que la souris, là où `touchstart` laisserait les ordinateurs
 * de côté.
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
