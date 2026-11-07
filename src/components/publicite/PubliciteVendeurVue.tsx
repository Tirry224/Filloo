import { Eye, MousePointerClick, TrendingUp } from "lucide-react";
import { jour } from "@/components/admin/EtatAnnonce";
import { EtatCampagne, tauxDeClics } from "@/components/publicite/EtatCampagne";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field, Input, Select } from "@/components/ui/Field";
import { Notice } from "@/components/ui/Notice";
import { PendingSubmit } from "@/components/ui/PendingSubmit";
import { Screen, ScreenBody, Section } from "@/components/ui/Screen";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { TopBar } from "@/components/ui/TopBar";
import { PrixIndicatifs } from "@/components/publicite/PrixIndicatifs";
import { annulerCampagneAction, declarerPaiementAction, demanderCampagneAction } from "@/lib/actions/publicite";
import {
  DUREES,
  MOYENS_PAIEMENT,
  TYPES_CAMPAGNE,
  type CampagneCommercant,
  type MoyenDePaiement,
  type Tarifs,
} from "@/lib/data/publicite";
import { formatGnf } from "@/lib/format";
import type { Product } from "@/lib/types";

/**
 * « Publicité et visibilité » (0047, 0048). Le commerçant choisit, voit le
 * prix, paie par Orange Money ou MTN MoMo au numéro de Filloo, puis
 * recopie la référence du SMS. L'équipe vérifie le paiement et met en
 * ligne ; sa décision arrive dans « Équipe Filloo ».
 */
export function PubliciteVendeurVue({
  produits,
  campagnes,
  tarifs,
  moyens,
  erreur,
  info,
}: {
  produits: Product[];
  campagnes: CampagneCommercant[];
  tarifs: Tarifs;
  moyens: MoyenDePaiement[];
  erreur?: string;
  info?: string;
}) {
  return (
    <Screen largeur="rangees">
      <TopBar backHref="/vendeur/boutique" title="Publicité et visibilité" />
      <ScreenBody>
        <Section className="gap-5">
          {erreur ? <Notice>{erreur}</Notice> : null}
          {info ? <Notice tone="success">{info}</Notice> : null}

          <ol className="flex list-decimal flex-col gap-1 rounded-lg bg-accent-soft py-3 pr-3.5 pl-8 text-sm leading-normal text-accent-hover">
            <li>Choisissez la publicité et sa durée.</li>
            <li>Payez par Orange Money ou MTN MoMo au numéro indiqué.</li>
            <li>Recopiez la référence du SMS : l&apos;équipe vérifie, puis la met en ligne.</li>
          </ol>

          <Card padded>
            <form action={demanderCampagneAction} className="flex flex-col gap-4">
              <h2 className="text-base font-bold">Nouvelle publicité</h2>
              <fieldset className="flex flex-col gap-2">
                <legend className="mb-1.5 text-sm font-semibold text-ink-soft">Type</legend>
                {Object.entries(TYPES_CAMPAGNE).map(([cle, { libelle, aide }], i) => (
                  <label key={cle} className="cursor-pointer">
                    <input type="radio" name="type" value={cle} defaultChecked={i === 0} className="peer sr-only" />
                    <span className="flex flex-col gap-0.5 rounded-lg border border-line bg-surface px-3 py-2.5 peer-checked:border-accent peer-checked:bg-accent-soft peer-focus-visible:shadow-focus">
                      <span className="text-sm font-semibold">{libelle}</span>
                      <span className="text-2xs text-ink-soft">{aide}</span>
                    </span>
                  </label>
                ))}
              </fieldset>
              <Field
                label="Produit"
                htmlFor="produit"
                hint="Pour un produit sponsorisé ou une promotion dans sa catégorie. Ignoré pour une boutique mise en avant."
              >
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
              <PendingSubmit className="flex h-control w-full cursor-pointer items-center justify-center rounded-lg bg-accent text-base font-semibold text-on-accent">
                Continuer vers le paiement
              </PendingSubmit>
            </form>
          </Card>

          <div className="flex flex-col gap-2.5">
            <SectionLabel>Mes publicités · {campagnes.length}</SectionLabel>
            {campagnes.length === 0 ? (
              <EmptyState icon={TrendingUp} title="Aucune publicité" description="Vos demandes et leurs résultats apparaîtront ici." />
            ) : (
              campagnes.map((c) => <LigneCampagne key={c.id} c={c} moyens={moyens} />)
            )}
          </div>
        </Section>
      </ScreenBody>
    </Screen>
  );
}

function LigneCampagne({ c, moyens }: { c: CampagneCommercant; moyens: MoyenDePaiement[] }) {
  const enCours = c.etat === "a_payer" || c.etat === "en_attente" || c.etat === "active";
  return (
    <Card padded className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <EtatCampagne etat={c.etat} />
        <span className="text-2xs text-ink-soft">
          {TYPES_CAMPAGNE[c.type].libelle} · {c.dureeJours} jours
        </span>
      </div>
      <span className="text-base font-semibold">
        {c.type === "boutique" ? "Ma boutique" : (c.produitTitre ?? "Produit supprimé")}
        {c.type === "categorie" && c.categorie ? ` · ${c.categorie}` : ""}
      </span>
      {c.prixGnf !== null ? (
        <p className="text-sm font-semibold">
          {c.offerteParLEquipe && !c.prixGnf ? "Offerte par Filloo" : c.prixGnf === 0 ? "Gratuite" : formatGnf(c.prixGnf)}
        </p>
      ) : null}
      {c.etat === "a_payer" ? <Payer c={c} moyens={moyens} /> : null}
      {c.etat === "en_attente" && c.paiementReference ? (
        <p className="text-sm text-ink-soft">
          Paiement déclaré ({c.paiementMoyen ? MOYENS_PAIEMENT[c.paiementMoyen] : ""}, réf. {c.paiementReference}) : l&apos;équipe le
          vérifie.
        </p>
      ) : null}
      {c.aRembourser ? <p className="text-sm text-ink-soft">L&apos;équipe Filloo va vous rembourser.</p> : null}
      {c.rembourseAt ? <p className="text-sm text-ink-soft">Remboursée le {jour(c.rembourseAt)}.</p> : null}
      {c.etat === "active" && c.finAt ? <p className="text-2xs text-ink-soft">Jusqu&apos;au {jour(c.finAt)}</p> : null}
      {c.etat === "terminee" && c.finAt ? <p className="text-2xs text-ink-soft">Terminée le {jour(c.finAt)}</p> : null}
      {c.motif && (c.etat === "refusee" || c.etat === "interrompue") ? (
        <p className="text-sm text-danger">Motif : {c.motif}</p>
      ) : null}
      {c.debutAt ? (
        <div className="grid grid-cols-3 gap-2 text-center">
          <Chiffre icone={Eye} valeur={c.vues} libelle="affichages" />
          <Chiffre icone={MousePointerClick} valeur={c.clics} libelle="clics" />
          <Chiffre icone={TrendingUp} valeur={tauxDeClics(c.vues, c.clics)} libelle="taux de clics" />
        </div>
      ) : null}
      {enCours ? (
        <form action={annulerCampagneAction}>
          <input type="hidden" name="campagne" value={c.id} />
          <PendingSubmit className="text-sm font-semibold text-danger">
            {c.etat === "active" ? "Arrêter cette publicité (sans remboursement)" : "Annuler cette publicité"}
          </PendingSubmit>
        </form>
      ) : null}
    </Card>
  );
}

function Chiffre({
  icone: Icone,
  valeur,
  libelle,
}: {
  icone: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string; "aria-hidden"?: boolean }>;
  valeur: number | string;
  libelle: string;
}) {
  return (
    <div className="flex flex-col items-center gap-0.5 rounded-lg bg-paper px-2 py-2">
      <Icone size={16} strokeWidth={1.9} className="text-ink-soft" aria-hidden />
      <span className="text-base font-bold">{valeur}</span>
      <span className="text-2xs text-ink-soft">{libelle}</span>
    </div>
  );
}

/** Où envoyer l'argent, puis de quoi le retrouver : la référence du SMS et le numéro qui a payé. */
function Payer({ c, moyens }: { c: CampagneCommercant; moyens: MoyenDePaiement[] }) {
  const actifs = moyens.filter((m) => m.actif);
  if (actifs.length === 0) {
    return <p className="text-sm text-ink-soft">Le paiement n&apos;est pas encore ouvert. L&apos;équipe Filloo vous contactera.</p>;
  }
  return (
    <div className="flex flex-col gap-3 border-t border-line pt-2.5">
      <p className="text-sm">
        Envoyez <strong>{c.prixGnf ? formatGnf(c.prixGnf) : ""}</strong> à l&apos;un de ces numéros :
      </p>
      <ul className="flex flex-col gap-1.5">
        {actifs.map((m) => (
          <li key={m.moyen} className="rounded-lg bg-paper px-3 py-2 text-sm">
            <span className="font-semibold">{MOYENS_PAIEMENT[m.moyen]}</span> · {m.numero}
            <span className="block text-2xs text-ink-soft">Au nom de {m.titulaire}</span>
          </li>
        ))}
      </ul>
      <form action={declarerPaiementAction} className="flex flex-col gap-3">
        <input type="hidden" name="campagne" value={c.id} />
        <Field label="Payé avec" htmlFor={`moyen-${c.id}`}>
          <Select id={`moyen-${c.id}`} name="moyen" defaultValue={actifs[0].moyen}>
            {actifs.map((m) => (
              <option key={m.moyen} value={m.moyen}>
                {MOYENS_PAIEMENT[m.moyen]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Référence du paiement" htmlFor={`reference-${c.id}`} hint="Elle est dans le SMS de confirmation.">
          <Input id={`reference-${c.id}`} name="reference" required minLength={3} maxLength={60} />
        </Field>
        <Field label="Numéro qui a payé" htmlFor={`numero-${c.id}`}>
          <Input id={`numero-${c.id}`} name="numero" inputMode="tel" required />
        </Field>
        <PendingSubmit className="flex h-control w-full cursor-pointer items-center justify-center rounded-lg bg-accent text-base font-semibold text-on-accent">
          J&apos;ai payé
        </PendingSubmit>
      </form>
    </div>
  );
}
