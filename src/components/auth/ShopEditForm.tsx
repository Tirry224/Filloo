"use client";

import { ShopPhotoPicker } from "@/components/auth/ShopPhotoPicker";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import { PhoneInput } from "@/components/ui/PhoneInput";
import { updateMerchantAction } from "@/lib/actions/merchants";
import type { CityOption } from "@/lib/data/reference";
import type { Merchant } from "@/lib/types";
import { useFormulaire } from "@/lib/use-formulaire";
import { NOM_MAX } from "@/lib/saisie";

/**
 * `merchant.status` ne change jamais ici (voir `updateMerchantAction`).
 */
export function ShopEditForm({
  merchant,
  cityId,
  photoPath,
  cities,
}: {
  merchant: Merchant;
  cityId: number;
  photoPath: string | null;
  cities: CityOption[];
}) {
  const { state, formAction, onSubmit, pending } = useFormulaire(updateMerchantAction);

  return (
    <form id="shop-edit-form" action={formAction} onSubmit={onSubmit} className="flex flex-col gap-4">
      <ShopPhotoPicker merchantId={merchant.id} shopName={merchant.shopName} initialPath={photoPath} />

      <Field label="Nom de la boutique" htmlFor="shopName">
        <Input id="shopName" name="shopName" maxLength={NOM_MAX} defaultValue={merchant.shopName} />
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
        <Input id="addressHint" name="addressHint" maxLength={200} defaultValue={merchant.addressHint ?? ""} />
      </Field>

      <Field label="Numéro WhatsApp" htmlFor="whatsappPhone">
        <PhoneInput id="whatsappPhone" name="whatsappPhone" defaultValue={merchant.whatsappPhone} />
      </Field>

      <Field label="Description" htmlFor="description">
        <Textarea id="description" name="description" maxLength={1000} rows={3} defaultValue={merchant.description ?? ""} />
      </Field>

      {/* La CONFIRMATION par mot de passe reste exigée pour enregistrer —
          c'est ce qui distingue « cette session est ouverte » de « c'est
          bien la bonne personne, maintenant » — mais elle se demande au
          moment du geste, dans `ConfirmPasswordSave`, dont le champ porte
          `form="shop-edit-form"`. */}

      {state?.error ? <p className="text-sm text-danger">{state.error}</p> : null}
    </form>
  );
}
