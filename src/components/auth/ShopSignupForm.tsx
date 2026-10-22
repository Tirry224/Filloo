"use client";

import { Button } from "@/components/ui/Button";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import { PhoneInput } from "@/components/ui/PhoneInput";
import { ScreenBody, ScreenFooter, Section } from "@/components/ui/Screen";
import { createMerchantAction } from "@/lib/actions/merchants";
import type { CityOption } from "@/lib/data/reference";
import { useFormulaire } from "@/lib/use-formulaire";
import { NOM_MAX } from "@/lib/saisie";

/** `telephoneCompte` : le numéro saisi à l'étape 1, repris ici pour que le
 *  commerçant n'ait pas à le retaper. Il reste modifiable : un WhatsApp
 *  peut être un autre numéro. */
export function ShopSignupForm({ cities, telephoneCompte }: { cities: CityOption[]; telephoneCompte: string }) {
  const { state, formAction, onSubmit, pending } = useFormulaire(createMerchantAction);

  return (
    <form action={formAction} onSubmit={onSubmit} className="flex flex-1 flex-col">
      <ScreenBody>
        <Section className="gap-4">
          <div className="flex items-center gap-2">
            <span className="h-1 flex-1 rounded-full bg-accent" />
            <span className="h-1 flex-1 rounded-full bg-accent" />
            <span className="text-xs font-semibold text-ink-soft">Étape 2 sur 2</span>
          </div>

          <p className="text-base leading-relaxed text-ink-soft">
            Votre boutique sera en ligne dès que vous aurez validé ces informations.
          </p>

          <Field label="Nom de la boutique" htmlFor="shopName">
            <Input id="shopName" name="shopName" maxLength={NOM_MAX} placeholder="Nom de votre boutique" />
          </Field>

          <Field label="Ville" htmlFor="cityId">
            <Select id="cityId" name="cityId" defaultValue="">
              <option value="" disabled>
                Choisir une ville
              </option>
              {cities.map((city) => (
                <option key={city.id} value={city.id}>
                  {city.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            label="Où vous trouver"
            htmlFor="addressHint"
            hint="Un repère que vos clients comprennent. C'est là que se fera la vente."
          >
            <Input id="addressHint" name="addressHint" maxLength={200} placeholder="Quartier, marché ou point de repère" />
          </Field>

          <Field
            label="Numéro WhatsApp"
            htmlFor="whatsappPhone"
            hint="Repris de votre compte. Changez-le seulement si votre WhatsApp est un autre numéro."
          >
            <PhoneInput id="whatsappPhone" name="whatsappPhone" placeholder="Numéro WhatsApp" defaultValue={telephoneCompte} />
          </Field>

          <Field label="Que vendez-vous ?" htmlFor="description">
            <Textarea id="description" name="description" maxLength={1000} rows={3} placeholder="Ce que vend votre boutique…" />
          </Field>

          {state?.error ? <p className="text-sm text-danger">{state.error}</p> : null}
        </Section>
      </ScreenBody>

      <ScreenFooter>
        <Button type="submit" disabled={pending}>{pending ? "Création…" : "Ouvrir ma boutique"}</Button>
      </ScreenFooter>
    </form>
  );
}
