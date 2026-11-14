import { useActionState, useEffect, useRef, type FormEvent } from "react";
import type { ActionState } from "@/lib/actions/auth";
import { garderLaSaisie } from "@/lib/garder-la-saisie";
import { EVENEMENT_ERREUR, type DetailEtat } from "@/components/ui/ErreurChamp";

type Action = (etat: ActionState | null, donnees: FormData) => Promise<ActionState>;

export const MESSAGE_HORS_LIGNE =
  "Pas de connexion. Votre saisie est gardée : réessayez plus tard.";

/**
 * Une coupure réseau ne doit JAMAIS emporter la saisie.
 *
 * Quand le `fetch` d'une action serveur échoue (réseau coupé, taxi entre
 * deux antennes), la promesse rejette un `TypeError`. Sans ce filet, le
 * rejet remontait jusqu'à `error.tsx` : l'écran entier devenait « Une
 * erreur est survenue de notre côté » — faux, c'était le réseau — et le
 * formulaire, photos comprises, disparaissait avec lui. Constaté le
 * 2026-09-25 en publiant un produit et en envoyant un message hors ligne.
 *
 * Seul `TypeError` est rattrapé : la redirection d'une action (`redirect`)
 * voyage par une autre exception, que Next doit continuer de recevoir.
 */
export function sansPerteReseau(action: Action): Action {
  return async (etat, donnees) => {
    try {
      return await action(etat, donnees);
    } catch (cause) {
      if (cause instanceof TypeError) return { error: MESSAGE_HORS_LIGNE };
      throw cause;
    }
  };
}

/**
 * Amène l'écran au champ que l'erreur nomme, message compris.
 *
 * `form.elements` trouve aussi un contrôle relié par `form=` hors du
 * formulaire (le mot de passe du panneau `ConfirmPasswordSave`). Un champ
 * sans contrôle à ce moment-là (aucune photo encore) se trouve par son
 * `data-champ`. Un panneau ouvert qui ne contient pas le champ se ferme :
 * il le cacherait.
 */
function allerAuChamp(form: HTMLFormElement, champ: string) {
  const trouve = form.elements.namedItem(champ);
  const controle = trouve instanceof RadioNodeList ? trouve[0] : trouve;
  const bloc =
    (controle instanceof Element ? controle.closest("[data-champ]") : null) ??
    form.querySelector(`[data-champ="${CSS.escape(champ)}"]`);
  if (!bloc) return;

  document.querySelectorAll<HTMLDetailsElement>("details[data-panneau][open]").forEach((panneau) => {
    if (!panneau.contains(bloc)) panneau.open = false;
  });
  // Après le rendu du message, pour qu'il entre dans l'écran avec le champ.
  requestAnimationFrame(() => {
    bloc.scrollIntoView({ behavior: "smooth", block: "center" });
    // Le clavier s'ouvre sur un champ de saisie, pas sur une case à cocher.
    const saisie =
      controle instanceof HTMLTextAreaElement ||
      controle instanceof HTMLSelectElement ||
      (controle instanceof HTMLInputElement && !["checkbox", "radio", "hidden"].includes(controle.type));
    if (saisie) controle.focus({ preventScroll: true });
  });
}

/**
 * `useActionState` pour les formulaires de Filloo, avec trois garanties :
 *
 * - **la saisie reste** après une erreur (`garderLaSaisie`) ;
 * - **une coupure réseau** se dit dans le formulaire au lieu de le
 *   détruire (`sansPerteReseau`) ;
 * - **un seul envoi à la fois**. `useActionState` met les envois en FILE :
 *   deux tapes rapides partent l'une après l'autre, et le bouton
 *   `disabled={pending}` n'est rendu qu'une fois la première déjà lancée.
 *   Trois tapes sur « Envoyer » publiaient deux messages identiques
 *   (2026-09-25). Le verrou est un `ref`, lu et posé dans le même
 *   événement : aucun rendu ne s'intercale.
 *
 * `avantEnvoi` reçoit le formulaire APRÈS la copie de ses données : la
 * zone de message s'y vide tout de suite, sans rien retirer de l'envoi.
 */
export function useFormulaire(
  action: Action,
  { avantEnvoi }: { avantEnvoi?: (formulaire: HTMLFormElement) => void } = {},
) {
  const [state, formAction, pending] = useActionState<ActionState | null, FormData>(sansPerteReseau(action), null);
  const enCours = useRef(false);

  // Rouvert quand l'envoi se termine, succès ou erreur. Un envoi qui
  // redirige démonte le formulaire : le verrou part avec lui.
  useEffect(() => {
    if (!pending) enCours.current = false;
  }, [pending]);

  /* Après chaque réponse : les champs rendus hors du formulaire
     l'apprennent (`ErreurChamp`), puis l'écran va au champ fautif. Chaque
     réponse est un objet neuf : la même erreur deux fois y ramène deux
     fois. */
  const formulaire = useRef<HTMLFormElement | null>(null);
  useEffect(() => {
    const form = formulaire.current;
    if (!form) return;
    if (form.id) {
      window.dispatchEvent(
        new CustomEvent<DetailEtat>(EVENEMENT_ERREUR, { detail: { formulaire: form.id, etat: state } }),
      );
    }
    if (state?.error && state.champ) allerAuChamp(form, state.champ);
  }, [state]);

  const envoyer = garderLaSaisie(formAction);
  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (enCours.current) return;
    enCours.current = true;
    formulaire.current = event.currentTarget;
    envoyer(event);
    avantEnvoi?.(event.currentTarget);
  };

  return { state, formAction, onSubmit, pending };
}
