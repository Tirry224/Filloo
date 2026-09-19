"use client";

import { useActionState } from "react";
import { Field, Input, Select } from "@/components/ui/Field";
import { updateProfileAction } from "@/lib/actions/account";
import type { ActionState } from "@/lib/actions/auth";
import type { CityOption } from "@/lib/data/reference";
import type { Espace } from "@/lib/espace";

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
  espace,
  fullName,
  phone,
  cityId,
  cities,
}: {
  id: string;
  /** IMPOSÉ par la route qui monte cet écran, jamais lu dans l'URL — la
   *  leçon de `src/lib/espace.ts`. Il décide de deux choses : si la ville
   *  de résidence est proposée, et dans quel espace l'enregistrement
   *  ramène. Une action ne fait pas changer d'espace. */
  espace: Espace;
  fullName: string;
  phone: string;
  cityId: number | null;
  cities: CityOption[];
}) {
  const [state, formAction] = useActionState<ActionState | null, FormData>(updateProfileAction, null);

  return (
    <form id={id} action={formAction} className="flex flex-col gap-4">
      {/* L'espace voyage dans le formulaire parce que l'action serveur ne
          peut pas le deviner : une connexion qui a les DEUX comptes est
          légitime des deux côtés, donc le déduire des profils renverrait
          la moitié des gens dans l'autre espace. Il ne choisit qu'entre
          deux chemins internes fixes — voir `updateProfileAction`, qui ne
          lui fait pas davantage confiance que ça. */}
      <input type="hidden" name="espace" value={espace} />
      <Field label="Nom complet" htmlFor="fullName">
        <Input id="fullName" name="fullName" autoComplete="name" defaultValue={fullName} />
      </Field>
      <Field label="Téléphone" htmlFor="phone">
        <Input id="phone" name="phone" type="tel" inputMode="tel" defaultValue={phone} />
      </Field>
      {/* LA VILLE N'EST PAS UNE INFORMATION DE COMMERÇANT.
          `profiles.city_id` est la ville de RÉSIDENCE d'un client
          (migration `0010`). Celle d'un commerçant est la ville de sa
          BOUTIQUE : elle vit dans `merchants.city_id`, elle est publique,
          et elle se modifie sur `/vendeur/boutique/modifier`. Proposer ce
          menu ici ferait croire qu'on déplace sa boutique. */}
      {espace === "client" ? (
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
      ) : null}
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
