import { startTransition, type FormEvent } from "react";

/**
 * Empêche React 19 de VIDER un formulaire après son envoi.
 *
 * Avec `<form action={fonction}>`, React remet le formulaire à zéro à
 * chaque envoi, même quand le serveur répond par une erreur : un chiffre
 * manquant dans le téléphone effaçait les cinq champs de l'inscription,
 * et un prix refusé effaçait le titre et la description d'un produit.
 * Constaté dans un navigateur le 2026-09-24.
 *
 * La sortie prévue par React (`react-dom`, `extractEvents$1`) : quand le
 * `submit` a déjà été annulé et que l'action part d'une transition,
 * React garde l'état « en cours » (`pending`, `useFormStatus`) mais ne
 * demande plus la remise à zéro.
 *
 * `action={formAction}` reste sur le `<form>` : avant que le JavaScript
 * soit chargé, c'est lui qui envoie le formulaire en POST au serveur. Sans
 * lui, le navigateur l'enverrait en GET — mots de passe dans l'adresse.
 *
 * Ne s'utilise plus directement : `useFormulaire` (`use-formulaire.ts`)
 * l'appelle, avec le verrou contre le double envoi et le filet contre les
 * coupures réseau. Un formulaire qui doit se vider — la zone de message —
 * le fait lui-même, au moment de l'envoi, pour pouvoir rendre le texte si
 * l'envoi échoue.
 */
export function garderLaSaisie(formAction: (data: FormData) => void) {
  return (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    /* Le bouton qui a envoyé le formulaire porte parfois la décision
       (`intent=publish` ou `intent=draft` dans `ProductForm`). On le copie
       à la main plutôt que par `new FormData(form, submitter)`, que les
       navigateurs d'avant 2023 ignorent sans rien dire. */
    const bouton = (event.nativeEvent as SubmitEvent).submitter;
    if (bouton instanceof HTMLButtonElement && bouton.name) data.set(bouton.name, bouton.value);
    startTransition(() => formAction(data));
  };
}
