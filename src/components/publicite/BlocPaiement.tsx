import { Field, Input, Select } from "@/components/ui/Field";
import { PendingSubmit } from "@/components/ui/PendingSubmit";
import { MOYENS_PAIEMENT, type MoyenDePaiement } from "@/lib/data/publicite";
import { formatGnf } from "@/lib/format";

/**
 * Où envoyer l'argent, puis de quoi le retrouver : la référence du SMS et
 * le numéro qui a payé. Le même pour une publicité (0058) et un
 * abonnement (0059) : seul le geste final change.
 */
export function BlocPaiement({
  montant,
  moyens,
  action,
  champ,
  id,
}: {
  montant: number | null;
  moyens: MoyenDePaiement[];
  action: (formData: FormData) => Promise<void>;
  champ: "campagne" | "abonnement" | "achat";
  id: string;
}) {
  const actifs = moyens.filter((m) => m.actif);
  if (actifs.length === 0) {
    return <p className="text-sm text-ink-soft">Le paiement n&apos;est pas encore ouvert. L&apos;équipe Filloo vous contactera.</p>;
  }
  return (
    <div className="flex flex-col gap-3 border-t border-line pt-2.5">
      <p className="text-sm">
        Envoyez <strong>{montant ? formatGnf(montant) : ""}</strong> à l&apos;un de ces numéros :
      </p>
      <ul className="flex flex-col gap-1.5">
        {actifs.map((m) => (
          <li key={m.moyen} className="rounded-lg bg-paper px-3 py-2 text-sm">
            <span className="font-semibold">{MOYENS_PAIEMENT[m.moyen]}</span> · {m.numero}
            <span className="block text-2xs text-ink-soft">Au nom de {m.titulaire}</span>
          </li>
        ))}
      </ul>
      <form action={action} className="flex flex-col gap-3">
        <input type="hidden" name={champ} value={id} />
        <Field label="Payé avec" htmlFor={`moyen-${id}`}>
          <Select id={`moyen-${id}`} name="moyen" defaultValue={actifs[0].moyen}>
            {actifs.map((m) => (
              <option key={m.moyen} value={m.moyen}>
                {MOYENS_PAIEMENT[m.moyen]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Référence du paiement" htmlFor={`reference-${id}`} hint="Elle est dans le SMS de confirmation.">
          <Input id={`reference-${id}`} name="reference" required minLength={3} maxLength={60} />
        </Field>
        <Field label="Numéro qui a payé" htmlFor={`numero-${id}`}>
          <Input id={`numero-${id}`} name="numero" inputMode="tel" required />
        </Field>
        <PendingSubmit className="flex h-control w-full cursor-pointer items-center justify-center rounded-lg bg-accent text-base font-semibold text-on-accent">
          J&apos;ai payé
        </PendingSubmit>
      </form>
    </div>
  );
}
