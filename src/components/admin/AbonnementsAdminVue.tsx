import Link from "next/link";
import { Crown } from "lucide-react";
import { ETATS_ABONNEMENT } from "@/components/abonnement/AbonnementVue";
import { BadgeFormule } from "@/components/abonnement/BadgeFormule";
import { AdminTopBar, EnTeteOnglet } from "@/components/admin/AdminTopBar";
import { jour, jourEtHeure } from "@/components/admin/EtatAnnonce";
import { OngletsVentes } from "@/components/admin/OngletsVentes";
import { Revenus } from "@/components/admin/PubliciteAdminVue";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field, Input, Select } from "@/components/ui/Field";
import { Notice } from "@/components/ui/Notice";
import { PendingSubmit } from "@/components/ui/PendingSubmit";
import { ScreenBody, Section, TabScreen } from "@/components/ui/Screen";
import { SectionLabel } from "@/components/ui/SectionLabel";
import {
  creerAbonnementEquipeAction,
  deciderAbonnementAction,
  interrompreAbonnementAction,
  marquerAbonnementRembourseAction,
} from "@/lib/actions/abonnements";
import { FORMULES, FORMULES_PAYANTES, lireFormulePayante, type AbonnementEquipe } from "@/lib/data/abonnements";
import { MOYENS_PAIEMENT, lireMoyen, type BoutiqueChoisie, type RevenuDuMois } from "@/lib/data/publicite";
import { formatGnf } from "@/lib/format";

const SECTIONS = [
  { titre: "Paiement à vérifier", garde: (a: AbonnementEquipe) => a.etat === "en_attente" },
  { titre: "À rembourser", garde: (a: AbonnementEquipe) => a.aRembourser },
  { titre: "En attente du paiement", garde: (a: AbonnementEquipe) => a.etat === "a_payer" },
  { titre: "Actifs", garde: (a: AbonnementEquipe) => a.etat === "active" },
  { titre: "Passés", garde: () => true },
] as const;

const sectionDe = (a: AbonnementEquipe) => SECTIONS.find((s) => s.garde(a))!.titre;

const BOUTON = "flex h-tap w-full cursor-pointer items-center justify-center rounded-lg text-base font-semibold";

/**
 * Les abonnements vus par l'équipe (0049) : vérifier un paiement déclaré,
 * activer, refuser, rembourser, interrompre, ou activer soi-même (payé en
 * main propre, ou offert). Chaque geste est signé dans l'historique, et le
 * commerçant reçoit un message.
 */
export function AbonnementsAdminVue({
  abonnements,
  revenus,
  boutiques,
  erreur,
  info,
}: {
  abonnements: AbonnementEquipe[];
  revenus: RevenuDuMois[];
  boutiques: BoutiqueChoisie[];
  erreur?: string;
  info?: string;
}) {
  return (
    <TabScreen largeur="rangees">
      <AdminTopBar />
      <ScreenBody>
        <Section className="gap-5">
          <EnTeteOnglet titre="Ventes" sousTitre="Abonnements Pro et Business, au mois. Prix : page « Prix et paiement »." />
          <OngletsVentes actif="abonnements" />
          {erreur ? <Notice>{erreur}</Notice> : null}
          {info ? <Notice tone="success">{info}</Notice> : null}
          <Revenus revenus={revenus} />
          <Link href="/admin/publicite/tarifs" className="text-sm font-semibold underline">
            Prix et numéros de paiement
          </Link>

          <details className="rounded-lg border border-line bg-surface p-4">
            <summary className="cursor-pointer text-base font-bold">Activer un abonnement</summary>
            <form action={creerAbonnementEquipeAction} className="mt-3 flex flex-col gap-3">
              <Field label="Boutique" htmlFor="boutique">
                <Select id="boutique" name="boutique" defaultValue="" required>
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
              <Field label="Formule" htmlFor="formule">
                <Select id="formule" name="formule" defaultValue="pro">
                  {FORMULES_PAYANTES.map((f) => (
                    <option key={f} value={f}>
                      {FORMULES[f].libelle}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Paiement" htmlFor="moyen" hint="« Offert » : rien n'est compté dans les revenus.">
                <Select id="moyen" name="moyen" defaultValue="especes">
                  {Object.entries(MOYENS_PAIEMENT).map(([cle, libelle]) => (
                    <option key={cle} value={cle}>
                      {libelle}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Référence (facultatif)" htmlFor="reference">
                <Input id="reference" name="reference" maxLength={60} />
              </Field>
              <PendingSubmit className={`${BOUTON} bg-accent text-on-accent`}>Activer pour 1 mois</PendingSubmit>
            </form>
          </details>

          {abonnements.length === 0 ? (
            <EmptyState icon={Crown} title="Aucun abonnement" description="Les demandes d'abonnement des commerçants apparaîtront ici." />
          ) : (
            SECTIONS.map(({ titre }) => {
              const liste = abonnements.filter((a) => sectionDe(a) === titre);
              if (!liste.length) return null;
              return (
                <div key={titre} className="flex flex-col gap-2.5">
                  <SectionLabel>
                    {titre} · {liste.length}
                  </SectionLabel>
                  {liste.map((a) => (
                    <LigneAbonnement key={a.id} a={a} />
                  ))}
                </div>
              );
            })
          )}
        </Section>
      </ScreenBody>
    </TabScreen>
  );
}

function LigneAbonnement({ a }: { a: AbonnementEquipe }) {
  const formule = lireFormulePayante(a.formule);
  const moyen = lireMoyen(a.paiement_moyen);
  return (
    <Card padded className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        {formule ? <BadgeFormule formule={formule} /> : null}
        <Badge tone={ETATS_ABONNEMENT[a.etat].ton}>{ETATS_ABONNEMENT[a.etat].libelle}</Badge>
        <span className="text-2xs text-ink-soft">demandé le {jourEtHeure(a.created_at)}</span>
      </div>
      <Link href={`/boutique/${a.merchant_id}`} target="_blank" className="text-base font-semibold">
        {a.shop_name}
      </Link>
      {a.debut_at && a.fin_at ? (
        <p className="text-2xs text-ink-soft">
          Du {jour(a.debut_at)} au {jour(a.fin_at)}
        </p>
      ) : null}
      <div className="flex flex-col gap-0.5 rounded-lg bg-paper px-3 py-2 text-sm">
        <span className="font-semibold">
          {a.prix_gnf ? formatGnf(a.prix_gnf) : "Offert"}
          {a.creee_par_equipe ? " · activé par l'équipe" : ""}
        </span>
        {moyen ? (
          <span>
            {MOYENS_PAIEMENT[moyen]}
            {a.paiement_numero ? ` · depuis le ${a.paiement_numero}` : ""}
            {a.paiement_reference ? ` · réf. ${a.paiement_reference}` : ""}
          </span>
        ) : (a.prix_gnf ?? 0) > 0 ? (
          <span className="text-ink-soft">Paiement pas encore déclaré</span>
        ) : null}
        {a.paiement_confirme_at ? <span className="text-2xs text-ink-soft">Vérifié le {jourEtHeure(a.paiement_confirme_at)}</span> : null}
        {a.rembourse_at ? <span className="text-2xs text-ink-soft">Remboursé le {jourEtHeure(a.rembourse_at)}</span> : null}
      </div>
      {a.motif ? <p className="text-sm text-ink-soft">Motif : {a.motif}</p> : null}

      {a.aRembourser ? (
        <form action={marquerAbonnementRembourseAction} className="border-t border-line pt-2.5">
          <input type="hidden" name="abonnement" value={a.id} />
          <PendingSubmit className={`${BOUTON} border border-line bg-surface`}>Remboursement fait</PendingSubmit>
        </form>
      ) : null}

      {a.etat === "en_attente" || a.etat === "a_payer" ? (
        <form action={deciderAbonnementAction} className="flex flex-col gap-2 border-t border-line pt-2.5">
          <input type="hidden" name="abonnement" value={a.id} />
          <input
            name="motif"
            maxLength={500}
            aria-label="Motif du refus"
            placeholder="Motif du refus (obligatoire pour refuser)"
            className="h-tap rounded-lg border border-line bg-surface px-3.5 text-base"
          />
          <div className={a.etat === "en_attente" ? "grid grid-cols-2 gap-2" : "grid grid-cols-1"}>
            {a.etat === "en_attente" ? (
              <button type="submit" name="decision" value="accepter" className={`${BOUTON} bg-accent text-on-accent`}>
                {(a.prix_gnf ?? 0) > 0 ? "Paiement reçu, activer" : "Activer"}
              </button>
            ) : null}
            <button type="submit" name="decision" value="refuser" className={`${BOUTON} border border-line bg-surface text-danger`}>
              Refuser
            </button>
          </div>
        </form>
      ) : null}

      {a.etat === "active" ? (
        <details className="border-t border-line pt-2.5">
          <summary className="cursor-pointer text-sm font-semibold text-danger">Interrompre</summary>
          <form action={interrompreAbonnementAction} className="mt-2 flex flex-col gap-2">
            <input type="hidden" name="abonnement" value={a.id} />
            <input
              name="motif"
              required
              minLength={3}
              maxLength={500}
              aria-label="Motif de l'interruption"
              placeholder="Motif, montré au commerçant"
              className="h-tap rounded-lg border border-line bg-surface px-3.5 text-base"
            />
            <PendingSubmit className={`${BOUTON} border border-line bg-surface text-danger`}>Interrompre l&apos;abonnement</PendingSubmit>
          </form>
        </details>
      ) : null}
    </Card>
  );
}
