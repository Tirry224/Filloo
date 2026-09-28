"use client";

import { Input } from "@/components/ui/Field";
import { formaterSaisiePrix } from "@/lib/prix";

/**
 * Le champ prix : les milliers se séparent pendant la frappe (« 1 500 000 »).
 *
 * Le curseur est replacé derrière le même nombre de chiffres : sans cela,
 * corriger un chiffre au milieu le renverrait en fin de champ. Sans
 * JavaScript, le champ accepte tout et `lirePrixGnf` tranche au serveur.
 */
export function PriceInput({
  defaultValue,
  ...props
}: Omit<React.ComponentProps<"input">, "type" | "inputMode" | "defaultValue" | "value" | "onChange"> & {
  defaultValue?: number | null;
}) {
  return (
    <Input
      {...props}
      type="text"
      inputMode="numeric"
      defaultValue={defaultValue == null ? "" : formaterSaisiePrix(String(defaultValue))}
      onChange={(e) => {
        const champ = e.currentTarget;
        const propre = formaterSaisiePrix(champ.value);
        if (propre === champ.value) return;
        const chiffresAvant = champ.value.slice(0, champ.selectionStart ?? champ.value.length).replace(/\D/g, "").length;
        champ.value = propre;
        let position = 0;
        for (let vus = 0; position < propre.length && vus < chiffresAvant; position++) {
          if (/\d/.test(propre[position])) vus++;
        }
        champ.setSelectionRange(position, position);
      }}
    />
  );
}
