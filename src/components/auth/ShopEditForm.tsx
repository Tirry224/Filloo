"use client";

import { useActionState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import { updateMerchantAction } from "@/lib/actions/merchants";
import type { ActionState } from "@/lib/actions/auth";
import type { CityOption } from "@/lib/data/reference";
import type { Merchant } from "@/lib/types";

/**
 * Écran 26 — modifier ma boutique. `merchant.status` ne change jamais ici :
 * voir le commentaire de `updateMerchantAction` sur la promesse de
 * « nouvelle vérification » retirée de cet écran.
 *
 * Pas de `<ScreenBody>`/`<ScreenFooter>` ici : c'est la page qui pose le
 * cadre, ce composant ne rend que les champs. Le bouton « Enregistrer »
 * vit dans la barre du haut et rejoint cette `<form>` par l'attribut HTML
 * `form`, pas par l'imbrication du JSX.
 *
 * Ce lien par attribut avait d'abord été choisi pour une autre raison :
 * ce formulaire cohabitait sur `/vendeur/boutique` avec des blocs qui
 * sont eux-mêmes de petites `<form>` (bascule d'espace, déconnexion), et
 * on n'imbrique pas une `<form>` dans une autre. Il vit maintenant seul
 * sur `/vendeur/boutique/modifier`, mais le montage reste le bon : un
 * bouton dans la barre du haut ne peut de toute façon pas être un enfant
 * du formulaire qu'il envoie.
 */
export function ShopEditForm({
  merchant,
  cityId,
  cities,
}: {
  merchant: Merchant;
  cityId: number;
  cities: CityOption[];
}) {
  const [state, formAction] = useActionState<ActionState | null, FormData>(updateMerchantAction, null);

  return (
    <form id="shop-edit-form" action={formAction} className="flex flex-col gap-4">
      <div className="flex items-center gap-3.5">
        <Avatar name={merchant.shopName} kind="shop" size={64} />
      </div>

      <Field label="Nom de la boutique" htmlFor="shopName">
        <Input id="shopName" name="shopName" defaultValue={merchant.shopName} />
      </Field>

      <Field label="Ville" htmlFor="cityId">
        <Select id="cityId" name="cityId" defaultValue={cityId}>
          {cities.map((city) => (
            <option key={city.id} value={city.id}>
              {city.name}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Où vous trouver" htmlFor="addressHint">
        <Input id="addressHint" name="addressHint" defaultValue={merchant.addressHint ?? ""} />
      </Field>

      <Field label="Numéro WhatsApp" htmlFor="whatsappPhone">
        <Input
          id="whatsappPhone"
          name="whatsappPhone"
          type="tel"
          inputMode="tel"
          defaultValue={merchant.whatsappPhone ?? ""}
        />
      </Field>

      <Field label="Description" htmlFor="description">
        <Textarea id="description" name="description" rows={3} defaultValue={merchant.description ?? ""} />
      </Field>

      {/* LE MOT DE PASSE VIT DANS CE FORMULAIRE, ET NON PLUS À CÔTÉ
          Il avait sa propre `<form>` sur l'onglet `/vendeur/boutique`, avec
          son propre bouton. Deux formulaires sur un même écran, c'est deux
          « enregistrer » qui ne sauvegardent pas la même chose : on remplit
          les deux, on appuie sur l'un, et la moitié du travail est perdue
          sans que rien ne le dise. Changer de mot de passe est désormais
          une modification du compte comme les autres, enregistrée par le
          même geste que le reste. */}
      <div className="my-1 h-px bg-line" />

      <Field label="Nouveau mot de passe" htmlFor="newPassword" hint="Laissez vide pour garder le mot de passe actuel.">
        <Input
          id="newPassword"
          name="newPassword"
          type="password"
          autoComplete="new-password"
          placeholder="8 caractères minimum"
        />
      </Field>

      {/* Même règle que l'inscription et la réinitialisation, portée par
          `erreurNouveauMotDePasse` : une seule définition pour les trois
          écrans, donc aucune chance qu'ils divergent le jour où la
          longueur minimale changera. */}
      <Field label="Confirmer le nouveau mot de passe" htmlFor="newPasswordConfirmation">
        <Input
          id="newPasswordConfirmation"
          name="newPasswordConfirmation"
          type="password"
          autoComplete="new-password"
          placeholder="Le même mot de passe"
        />
      </Field>

      {/* LA CONFIRMATION, EN DERNIER ET TOUJOURS EXIGÉE
          Elle garde l'enregistrement entier, pas seulement le mot de passe :
          l'adresse et le numéro WhatsApp affichés ici sont ce qu'un client
          lit avant de se déplacer. Quelqu'un qui emprunte un téléphone
          déverrouillé quelques secondes pouvait les réécrire sans rien
          connaître du compte. Ce champ est ce qui distingue « cette session
          est ouverte » de « c'est bien la bonne personne, maintenant ».

          `autoComplete="current-password"` pour que le gestionnaire de mots
          de passe propose l'ANCIEN, pas d'en inventer un nouveau. */}
      <Field
        label="Mot de passe actuel"
        htmlFor="currentPassword"
        hint="Obligatoire : sans lui, rien n'est enregistré."
      >
        <Input
          id="currentPassword"
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          placeholder="Votre mot de passe"
        />
      </Field>

      {state?.error ? <p className="text-sm text-danger">{state.error}</p> : null}
    </form>
  );
}
