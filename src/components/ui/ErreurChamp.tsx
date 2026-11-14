"use client";

import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { ActionState } from "@/lib/actions/auth";

/**
 * L'erreur d'un formulaire s'affiche SOUS LE CHAMP qu'elle concerne
 * (décision du porteur du projet, 2026-11-14). Avant, elle tombait tout
 * en bas : « OTS SHOP » a tapé sept fois « Publier » sans voir que le
 * titre manquait, le message étant sous la description.
 *
 * L'action serveur nomme le champ (`champ`, le `name` du contrôle) ; le
 * formulaire publie son état par `ErreursFormulaire`, et chaque `Field`
 * affiche l'erreur qui porte son nom. Une erreur sans champ (réseau,
 * session) reste au pied du formulaire, près du bouton.
 */
const Etat = createContext<ActionState | null>(null);

/** Nom de l'événement par lequel `useFormulaire` annonce son état aux
 * champs rendus HORS du formulaire (attribut `form=`), comme le mot de
 * passe du panneau `ConfirmPasswordSave`. */
export const EVENEMENT_ERREUR = "filloo:etat-formulaire";
export type DetailEtat = { formulaire: string; etat: ActionState | null };

export function ErreursFormulaire({ etat, children }: { etat: ActionState | null; children: React.ReactNode }) {
  return <Etat.Provider value={etat}>{children}</Etat.Provider>;
}

/** Le message sous un champ. `formulaire` : l'`id` du formulaire, pour un
 * champ qui vit hors de lui. */
export function ErreurChamp({ champ, formulaire }: { champ: string; formulaire?: string }) {
  const contexte = useContext(Etat);
  const [distant, setDistant] = useState<ActionState | null>(null);

  useEffect(() => {
    if (!formulaire) return;
    const ecouter = (e: Event) => {
      const detail = (e as CustomEvent<DetailEtat>).detail;
      if (detail.formulaire === formulaire) setDistant(detail.etat);
    };
    window.addEventListener(EVENEMENT_ERREUR, ecouter);
    return () => window.removeEventListener(EVENEMENT_ERREUR, ecouter);
  }, [formulaire]);

  const etat = formulaire ? distant : contexte;
  if (!etat?.error || etat.champ !== champ) return null;
  return (
    <p role="alert" data-erreur className="text-sm font-medium text-danger">
      {etat.error}
    </p>
  );
}

/**
 * Le message qui ne concerne aucun champ : au pied du formulaire.
 *
 * Filet : une erreur qui nomme un champ absent de l'écran (champ masqué
 * dans ce mode, nom mal recopié) s'affiche ici plutôt que nulle part.
 */
export function ErreurGenerale({ etat }: { etat: ActionState | null }) {
  const repere = useRef<HTMLSpanElement>(null);
  const [orphelin, setOrphelin] = useState(false);

  useLayoutEffect(() => {
    const form = repere.current?.closest("form");
    const champ = etat?.champ;
    if (!form || !champ) return setOrphelin(false);
    setOrphelin(!form.elements.namedItem(champ) && !form.querySelector(`[data-champ="${CSS.escape(champ)}"]`));
  }, [etat]);

  const visible = etat?.error && (!etat.champ || orphelin);
  return (
    <>
      <span ref={repere} hidden />
      {visible ? (
        <p role="alert" className="text-sm text-danger">
          {etat.error}
        </p>
      ) : null}
    </>
  );
}
