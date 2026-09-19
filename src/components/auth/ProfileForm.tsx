"use client";

import { useActionState } from "react";
import { Field, Input, Select } from "@/components/ui/Field";
import { updateProfileAction } from "@/lib/actions/account";
import type { ActionState } from "@/lib/actions/auth";
import type { CityOption } from "@/lib/data/reference";

/** Nom, téléphone et ville de résidence — écran 18. Le bouton
 * « Enregistrer » vit dans la barre du haut de la page (relié par
 * l'attribut HTML `form`), pas ici : la page affiche aussi le mot de
 * passe et la suppression du compte, qui ne doivent pas se retrouver DANS
 * ce formulaire.
 *
 * La ville reste facultative (option « Non renseignée ») : contrairement
 * au nom et au téléphone, ce n'est pas une information obligatoire pour
 * utiliser l'app, et tous les clients déjà inscrits n'en ont pas encore
 * choisi une (0010_client_profile_city.sql). */
export function ProfileForm({
  id,
  fullName,
  phone,
  cityId,
  cities,
}: {
  id: string;
  fullName: string;
  phone: string;
  cityId: number | null;
  cities: CityOption[];
}) {
  const [state, formAction] = useActionState<ActionState | null, FormData>(updateProfileAction, null);

  return (
    <form id={id} action={formAction} className="flex flex-col gap-4">
      <Field label="Nom complet" htmlFor="fullName">
        <Input id="fullName" name="fullName" autoComplete="name" defaultValue={fullName} />
      </Field>
      <Field label="Téléphone" htmlFor="phone">
        <Input id="phone" name="phone" type="tel" inputMode="tel" defaultValue={phone} />
      </Field>
      <Field label="Ville de résidence" htmlFor="cityId">
        <Select id="cityId" name="cityId" defaultValue={cityId ?? ""}>
          <option value="">Non renseignée</option>
          {cities.map((city) => (
            <option key={city.id} value={city.id}>
              {city.name}
            </option>
          ))}
        </Select>
      </Field>
      {/* LA CONFIRMATION PAR MOT DE PASSE, ET CE QU'ELLE PROTÈGE
          Le nom et le téléphone d'un compte client sont ce par quoi un
          commerçant le rappelle après une commande. Quelqu'un qui emprunte
          un téléphone déverrouillé quelques secondes pouvait les réécrire
          sans rien connaître du compte, et détourner vers lui les rappels
          destinés à quelqu'un d'autre. Redemander le mot de passe au
          moment d'écrire distingue « cette session est ouverte » de
          « c'est bien la bonne personne, maintenant ».

          Même geste que l'enregistrement d'une boutique : le parcours est
          le même des deux côtés, donc personne n'a deux habitudes à
          prendre. */}
      <div className="my-1 h-px bg-line" />

      <Field
        label="Mot de passe actuel"
        htmlFor="currentPassword"
        hint="Il confirme que c'est bien vous. Il n'est pas modifié ici."
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
