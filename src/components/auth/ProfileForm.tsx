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
      {/* LA CONFIRMATION PAR MOT DE PASSE N'EST PAS DANS CE FORMULAIRE
          Le nom et le téléphone d'un compte client sont ce par quoi un
          commerçant le rappelle après une commande : les réécrire depuis
          un téléphone emprunté détournerait ces rappels. Le mot de passe
          actuel est donc exigé pour écrire — mais il se demande AU MOMENT
          d'enregistrer, dans le panneau de `ConfirmPasswordSave`, et non
          en bas d'une liste de champs qu'on remplit avant même d'avoir
          décidé. Le champ y porte `form="profile-form"`, ce qui le relie
          à ce formulaire sans y être imbriqué. */}

      {state?.error ? <p className="text-sm text-danger">{state.error}</p> : null}
    </form>
  );
}
