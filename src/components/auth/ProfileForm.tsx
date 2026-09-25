"use client";

import { Field, Input, Select } from "@/components/ui/Field";
import { updateProfileAction } from "@/lib/actions/account";
import type { CityOption } from "@/lib/data/reference";
import type { Espace } from "@/lib/espace";
import { useFormulaire } from "@/lib/use-formulaire";

export function ProfileForm({
  id,
  espace,
  fullName,
  phone,
  cityId,
  cities,
}: {
  id: string;
  /** IMPOSÉ par la route qui monte cet écran, jamais lu dans l'URL (voir
   *  `src/lib/espace.ts`). Il décide si la ville de résidence est
   *  proposée, et dans quel espace l'enregistrement ramène. */
  espace: Espace;
  fullName: string;
  phone: string;
  cityId: number | null;
  cities: CityOption[];
}) {
  const { state, formAction, onSubmit, pending } = useFormulaire(updateProfileAction);

  return (
    <form id={id} action={formAction} onSubmit={onSubmit} className="flex flex-col gap-4">
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
      {/* Le mot de passe actuel est exigé pour écrire : il se demande AU
          MOMENT d'enregistrer, dans le panneau de `ConfirmPasswordSave`,
          dont le champ porte `form="profile-form"`. */}

      {state?.error ? <p className="text-sm text-danger">{state.error}</p> : null}
    </form>
  );
}
