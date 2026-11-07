import { Card } from "@/components/ui/Card";
import { Field, Input } from "@/components/ui/Field";
import { Notice } from "@/components/ui/Notice";
import { PendingSubmit } from "@/components/ui/PendingSubmit";
import { Screen, ScreenBody, Section } from "@/components/ui/Screen";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { TopBar } from "@/components/ui/TopBar";
import { fixerMoyenPaiementAction, fixerTarifsAction } from "@/lib/actions/publicite";
import {
  DUREES,
  MOYENS_MOBILES,
  MOYENS_PAIEMENT,
  TYPES_CAMPAGNE,
  type MoyenDePaiement,
  type Tarifs,
  type TypeCampagne,
} from "@/lib/data/publicite";

const BOUTON =
  "flex h-control w-full cursor-pointer items-center justify-center rounded-lg bg-accent text-base font-semibold text-on-accent";

/**
 * Les prix de la publicité et les numéros où les commerçants paient
 * (0048). Un prix change pour les demandes À VENIR : celui d'une demande
 * déjà faite est figé dessus. Chaque changement s'inscrit dans
 * l'historique de l'équipe.
 */
export function TarifsPubliciteVue({
  tarifs,
  moyens,
  erreur,
  info,
}: {
  tarifs: Tarifs;
  moyens: MoyenDePaiement[];
  erreur?: string;
  info?: string;
}) {
  const parMoyen = new Map(moyens.map((m) => [m.moyen, m]));
  return (
    <Screen largeur="rangees">
      <TopBar backHref="/admin/publicite" title="Prix et paiement" />
      <ScreenBody>
        <Section className="gap-5">
          {erreur ? <Notice>{erreur}</Notice> : null}
          {info ? <Notice tone="success">{info}</Notice> : null}

          <div className="flex flex-col gap-2.5">
            <SectionLabel>Prix en GNF</SectionLabel>
            <p className="text-sm text-ink-soft">
              Le nouveau prix vaut pour les prochaines demandes. Une demande déjà faite garde le sien. 0 = offert.
            </p>
            <form action={fixerTarifsAction} className="flex flex-col gap-3">
              {(Object.keys(TYPES_CAMPAGNE) as TypeCampagne[]).map((type) => (
                <Card key={type} padded className="flex flex-col gap-3">
                  <h2 className="text-base font-bold">{TYPES_CAMPAGNE[type].libelle}</h2>
                  <div className="grid grid-cols-2 gap-3">
                    {DUREES.map((d) => {
                      const prix = tarifs[type][d];
                      const id = `prix-${type}-${d}`;
                      return (
                        <Field key={d} label={`${d} jours`} htmlFor={id}>
                          <input type="hidden" name={`ancien:${type}:${d}`} value={prix ?? ""} />
                          <Input
                            id={id}
                            name={`prix:${type}:${d}`}
                            inputMode="numeric"
                            defaultValue={prix ?? ""}
                            placeholder="Pas de prix"
                          />
                        </Field>
                      );
                    })}
                  </div>
                </Card>
              ))}
              <PendingSubmit className={BOUTON}>Enregistrer les prix</PendingSubmit>
            </form>
          </div>

          <div className="flex flex-col gap-2.5">
            <SectionLabel>Numéros de paiement</SectionLabel>
            <p className="text-sm text-ink-soft">
              Les commerçants envoient leur paiement à ces numéros. Seul un numéro actif leur est montré.
            </p>
            {MOYENS_MOBILES.map((moyen) => {
              const m = parMoyen.get(moyen);
              return (
                <Card key={moyen} padded>
                  <form action={fixerMoyenPaiementAction} className="flex flex-col gap-3">
                    <input type="hidden" name="moyen" value={moyen} />
                    <h2 className="text-base font-bold">{MOYENS_PAIEMENT[moyen]}</h2>
                    <Field label="Numéro" htmlFor={`numero-${moyen}`}>
                      <Input id={`numero-${moyen}`} name="numero" inputMode="tel" defaultValue={m?.numero ?? ""} required />
                    </Field>
                    <Field label="Nom du titulaire" htmlFor={`titulaire-${moyen}`} hint="Le nom que le commerçant voit au moment de payer.">
                      <Input id={`titulaire-${moyen}`} name="titulaire" defaultValue={m?.titulaire ?? ""} required maxLength={80} />
                    </Field>
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" name="actif" defaultChecked={m?.actif ?? false} className="size-4" />
                      Montré aux commerçants
                    </label>
                    <PendingSubmit className={BOUTON}>Enregistrer</PendingSubmit>
                  </form>
                </Card>
              );
            })}
          </div>
        </Section>
      </ScreenBody>
    </Screen>
  );
}
