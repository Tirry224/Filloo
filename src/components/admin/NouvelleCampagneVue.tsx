import { Card } from "@/components/ui/Card";
import { Field, Input, Select } from "@/components/ui/Field";
import { Notice } from "@/components/ui/Notice";
import { PendingSubmit } from "@/components/ui/PendingSubmit";
import { Screen, ScreenBody, Section } from "@/components/ui/Screen";
import { TopBar } from "@/components/ui/TopBar";
import { PrixIndicatifs } from "@/components/publicite/PrixIndicatifs";
import { creerCampagneEquipeAction } from "@/lib/actions/publicite";
import {
  DUREES,
  MOYENS_PAIEMENT,
  TYPES_CAMPAGNE,
  type BoutiqueChoisie,
  type Tarifs,
  type TypeCampagne,
} from "@/lib/data/publicite";
import type { Product } from "@/lib/types";

const BOUTON =
  "flex h-control w-full cursor-pointer items-center justify-center rounded-lg bg-accent text-base font-semibold text-on-accent";

/**
 * L'équipe met une publicité en ligne elle-même (0048) : un commerçant qui
 * a payé en main propre ou par téléphone, ou une publicité offerte. Elle
 * part en ligne tout de suite, et le commerçant reçoit un message.
 * Deux étapes : la boutique d'abord (pour proposer SES produits).
 */
export function NouvelleCampagneVue({
  boutiques,
  boutique,
  produits,
  tarifs,
  erreur,
}: {
  boutiques: BoutiqueChoisie[];
  boutique: BoutiqueChoisie | null;
  produits: Product[];
  tarifs: Tarifs;
  erreur?: string;
}) {
  return (
    <Screen largeur="rangees">
      <TopBar backHref="/admin/publicite" title="Nouvelle publicité" />
      <ScreenBody>
        <Section className="gap-5">
          {erreur ? <Notice>{erreur}</Notice> : null}

          <Card padded>
            <form method="get" className="flex flex-col gap-3">
              <Field label="Boutique" htmlFor="boutique">
                <Select id="boutique" name="boutique" defaultValue={boutique?.id ?? ""} required>
                  <option value="" disabled>
                    Choisir une boutique
                  </option>
                  {boutiques.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.nom}
                    </option>
                  ))}
                </Select>
              </Field>
              <button type="submit" className="h-tap cursor-pointer rounded-lg border border-line bg-surface text-base font-semibold">
                {boutique ? "Changer de boutique" : "Continuer"}
              </button>
            </form>
          </Card>

          {boutique ? (
            <Card padded>
              <form action={creerCampagneEquipeAction} className="flex flex-col gap-4">
                <input type="hidden" name="boutique" value={boutique.id} />
                <h2 className="text-base font-bold">{boutique.nom}</h2>
                <Field label="Type" htmlFor="type">
                  <Select id="type" name="type" defaultValue="produit">
                    {(Object.keys(TYPES_CAMPAGNE) as TypeCampagne[]).map((t) => (
                      <option key={t} value={t}>
                        {TYPES_CAMPAGNE[t].libelle}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Produit" htmlFor="produit" hint="Ignoré pour une boutique mise en avant.">
                  <Select id="produit" name="produit" defaultValue={produits[0]?.id ?? ""}>
                    {produits.length === 0 ? <option value="">Aucun produit publié</option> : null}
                    {produits.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title} · {p.category}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Durée" htmlFor="duree">
                  <Select id="duree" name="duree" defaultValue="7">
                    {DUREES.map((d) => (
                      <option key={d} value={d}>
                        {d} jours
                      </option>
                    ))}
                  </Select>
                </Field>
                <PrixIndicatifs tarifs={tarifs} />
                <Field label="Paiement" htmlFor="moyen" hint="« Offert » : aucun montant n'est compté dans les revenus.">
                  <Select id="moyen" name="moyen" defaultValue="especes">
                    {Object.entries(MOYENS_PAIEMENT).map(([cle, libelle]) => (
                      <option key={cle} value={cle}>
                        {libelle}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Référence (facultatif)" htmlFor="reference" hint="Référence du SMS de paiement, ou numéro du reçu.">
                  <Input id="reference" name="reference" maxLength={60} />
                </Field>
                <PendingSubmit className={BOUTON}>Mettre en ligne</PendingSubmit>
              </form>
            </Card>
          ) : null}
        </Section>
      </ScreenBody>
    </Screen>
  );
}
