"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import { ScreenBody, ScreenFooter, Section } from "@/components/ui/Screen";
import { createMerchantAction } from "@/lib/actions/merchants";
import type { ActionState } from "@/lib/actions/auth";
import type { CityOption } from "@/lib/data/reference";
import { garderLaSaisie } from "@/lib/garder-la-saisie";

export function ShopSignupForm({ cities }: { cities: CityOption[] }) {
  const [state, formAction, pending] = useActionState<ActionState | null, FormData>(createMerchantAction, null);

  return (
    <form action={formAction} onSubmit={garderLaSaisie(formAction)} className="flex flex-1 flex-col">
      <ScreenBody>
        <Section className="gap-4">
          <div className="flex items-center gap-2">
            <span className="h-1 flex-1 rounded-full bg-accent" />
            <span className="h-1 flex-1 rounded-full bg-accent" />
            <span className="text-xs font-semibold text-ink-soft">Étape 2 sur 2</span>
          </div>

          <p className="text-base leading-relaxed text-ink-soft">
            Ces informations seront vérifiées avant la mise en ligne de votre boutique.
          </p>

          <Field label="Nom de la boutique" htmlFor="shopName">
            <Input id="shopName" name="shopName" placeholder="Chez Aïssatou" />
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
            <Input id="addressHint" name="addressHint" placeholder="Marché de Madina, allée 3" />
          </Field>

          <Field
            label="Numéro WhatsApp"
            htmlFor="whatsappPhone"
            hint="Affiché sur vos produits, en plus de la messagerie. Laissez vide pour utiliser le numéro de votre compte."
          >
            <Input id="whatsappPhone" name="whatsappPhone" type="tel" inputMode="tel" placeholder="622 33 44 55" />
          </Field>

          <Field label="Que vendez-vous ?" htmlFor="description">
            <Textarea id="description" name="description" rows={3} placeholder="Alimentation générale : riz, huile, sucre, lait…" />
          </Field>

          {state?.error ? <p className="text-sm text-danger">{state.error}</p> : null}
        </Section>
      </ScreenBody>

      <ScreenFooter>
        <Button type="submit" disabled={pending}>{pending ? "Envoi…" : "Envoyer pour vérification"}</Button>
      </ScreenFooter>
    </form>
  );
}
