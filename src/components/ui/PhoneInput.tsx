"use client";

import { Input } from "@/components/ui/Field";
import { formaterSaisieTelephone } from "@/lib/telephone";

/**
 * Le champ de tous les numéros guinéens : on ne peut pas y taper plus de
 * neuf chiffres, ni autre chose que des chiffres.
 *
 * Pas de `maxLength` : il couperait un « +224 622 33 44 55 » COLLÉ avant
 * que l'indicatif soit retiré. Sans JavaScript, le champ accepte tout et
 * le serveur (`erreurTelephone`) refuse — le formulaire marche quand même.
 */
export function PhoneInput({
  defaultValue,
  ...props
}: Omit<React.ComponentProps<"input">, "type" | "inputMode" | "defaultValue" | "value" | "onChange"> & {
  defaultValue?: string | null;
}) {
  return (
    <Input
      {...props}
      type="tel"
      inputMode="numeric"
      defaultValue={formaterSaisieTelephone(defaultValue ?? "")}
      onChange={(e) => {
        const propre = formaterSaisieTelephone(e.currentTarget.value);
        if (propre !== e.currentTarget.value) e.currentTarget.value = propre;
      }}
    />
  );
}
