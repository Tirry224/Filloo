import { Eye, MousePointerClick, TrendingUp } from "lucide-react";
import { jour } from "@/components/admin/EtatAnnonce";
import { EtatCampagne, tauxDeClics } from "@/components/publicite/EtatCampagne";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field, Select } from "@/components/ui/Field";
import { Notice } from "@/components/ui/Notice";
import { PendingSubmit } from "@/components/ui/PendingSubmit";
import { Screen, ScreenBody, Section } from "@/components/ui/Screen";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { TopBar } from "@/components/ui/TopBar";
import { annulerCampagneAction, demanderCampagneAction } from "@/lib/actions/publicite";
import { DUREES, TYPES_CAMPAGNE, type CampagneCommercant } from "@/lib/data/publicite";
import type { Product } from "@/lib/types";

/**
 * « Publicité et visibilité » (0047). Pas encore de paiement : la demande
 * part à l'équipe Filloo, qui la valide avant la mise en ligne. Le prix
 * s'affichera ici quand la grille tarifaire sera décidée.
 */
export function PubliciteVendeurVue({
  produits,
  campagnes,
  erreur,
  info,
}: {
  produits: Product[];
  campagnes: CampagneCommercant[];
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

          <p className="rounded-lg bg-accent-soft px-3.5 py-3 text-sm leading-normal text-accent-hover">
            Pendant la phase de lancement, la publicité est offerte. Chaque demande est vérifiée par l&apos;équipe
            Filloo avant sa mise en ligne.
          </p>

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
              <PendingSubmit className="flex h-control w-full cursor-pointer items-center justify-center rounded-lg bg-accent text-base font-semibold text-on-accent">
                Envoyer la demande
              </PendingSubmit>
            </form>
          </Card>

          <div className="flex flex-col gap-2.5">
            <SectionLabel>Mes publicités · {campagnes.length}</SectionLabel>
            {campagnes.length === 0 ? (
              <EmptyState icon={TrendingUp} title="Aucune publicité" description="Vos demandes et leurs résultats apparaîtront ici." />
            ) : (
              campagnes.map((c) => <LigneCampagne key={c.id} c={c} />)
            )}
          </div>
        </Section>
      </ScreenBody>
    </Screen>
  );
}

function LigneCampagne({ c }: { c: CampagneCommercant }) {
  const enCours = c.etat === "en_attente" || c.etat === "active";
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
          <PendingSubmit className="text-sm font-semibold text-danger">Annuler cette publicité</PendingSubmit>
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
