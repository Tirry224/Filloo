import { Check } from "lucide-react";
import { jour } from "@/components/admin/EtatAnnonce";
import { BadgeFormule } from "@/components/abonnement/BadgeFormule";
import { BlocPaiement } from "@/components/publicite/BlocPaiement";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Notice } from "@/components/ui/Notice";
import { PendingSubmit } from "@/components/ui/PendingSubmit";
import { Screen, ScreenBody, Section } from "@/components/ui/Screen";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { TopBar } from "@/components/ui/TopBar";
import { annulerAbonnementAction, declarerPaiementAbonnementAction, demanderAbonnementAction } from "@/lib/actions/abonnements";
import {
  FORMULES,
  FORMULES_PAYANTES,
  type AbonnementCommercant,
  type EtatAbonnement,
  type MaFormule,
  type TarifsAbonnement,
} from "@/lib/data/abonnements";
import { MOYENS_PAIEMENT, type MoyenDePaiement } from "@/lib/data/publicite";
import { formatGnf } from "@/lib/format";

export const ETATS_ABONNEMENT: Record<EtatAbonnement, { libelle: string; ton: "neutral" | "accent" | "success" | "warn" | "danger" }> = {
  a_payer: { libelle: "À payer", ton: "warn" },
  en_attente: { libelle: "En vérification", ton: "warn" },
  active: { libelle: "Actif", ton: "success" },
  terminee: { libelle: "Terminé", ton: "neutral" },
  refusee: { libelle: "Refusé", ton: "danger" },
  annulee: { libelle: "Annulé", ton: "neutral" },
  interrompue: { libelle: "Interrompu", ton: "danger" },
};

/**
 * « Mon abonnement » (0049) : la formule actuelle, les trois formules, et
 * le même parcours de paiement que la publicité. Un abonnement dure un
 * mois ; le renouveler avant la fin ajoute un mois à la suite.
 */
export function AbonnementVue({
  ma,
  tarifs,
  abonnements,
  moyens,
  produitsPublies,
  erreur,
  info,
}: {
  ma: MaFormule;
  tarifs: TarifsAbonnement;
  abonnements: AbonnementCommercant[];
  moyens: MoyenDePaiement[];
  produitsPublies: number;
  erreur?: string;
  info?: string;
}) {
  const demandeEnCours = abonnements.find((a) => a.etat === "a_payer" || a.etat === "en_attente");
  return (
    <Screen largeur="rangees">
      <TopBar backHref="/vendeur/boutique" title="Mon abonnement" />
      <ScreenBody>
        <Section className="gap-5">
          {erreur ? <Notice>{erreur}</Notice> : null}
          {info ? <Notice tone="success">{info}</Notice> : null}

          <Card padded className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <span className="text-sm text-ink-soft">Votre formule :</span>
              {ma.formule === "gratuit" ? <Badge tone="neutral">Gratuit</Badge> : <BadgeFormule formule={ma.formule} />}
            </div>
            {ma.formule !== "gratuit" && ma.finAt ? (
              <p className={ma.enGrace ? "text-sm text-danger" : "text-sm text-ink-soft"}>
                {ma.enGrace
                  ? `Terminé le ${jour(ma.finAt)}. Renouvelez avant 7 jours, sinon vos produits au-delà de 10 seront masqués.`
                  : `Jusqu'au ${jour(ma.finAt)}.`}
              </p>
            ) : null}
            {ma.limiteProduits !== null ? (
              <p className="text-sm text-ink-soft">
                {produitsPublies} / {ma.limiteProduits} produits publiés.
              </p>
            ) : null}
          </Card>

          {demandeEnCours ? (
            <LigneAbonnement a={demandeEnCours} moyens={moyens} />
          ) : (
            <div className="flex flex-col gap-2.5">
              <SectionLabel>{ma.formule === "gratuit" ? "Passer à une formule payante" : "Renouveler ou changer"}</SectionLabel>
              {FORMULES_PAYANTES.map((f) => (
                <Card key={f} padded className="flex flex-col gap-3">
                  <div className="flex items-center justify-between gap-2">
                    <BadgeFormule formule={f} />
                    <span className="text-base font-bold">
                      {tarifs[f] === undefined ? "—" : `${formatGnf(tarifs[f]!)} / mois`}
                    </span>
                  </div>
                  <Avantages formule={f} />
                  <form action={demanderAbonnementAction}>
                    <input type="hidden" name="formule" value={f} />
                    <PendingSubmit className="flex h-control w-full cursor-pointer items-center justify-center rounded-lg bg-accent text-base font-semibold text-on-accent">
                      {ma.formule === f ? "Renouveler 1 mois" : `Choisir ${FORMULES[f].libelle}`}
                    </PendingSubmit>
                  </form>
                </Card>
              ))}
              <Card padded className="flex flex-col gap-2">
                <Badge tone="neutral">Gratuit</Badge>
                <Avantages formule="gratuit" />
              </Card>
            </div>
          )}

          {abonnements.filter((a) => a !== demandeEnCours).length ? (
            <div className="flex flex-col gap-2.5">
              <SectionLabel>Historique</SectionLabel>
              {abonnements
                .filter((a) => a !== demandeEnCours)
                .map((a) => (
                  <LigneAbonnement key={a.id} a={a} moyens={moyens} />
                ))}
            </div>
          ) : null}
        </Section>
      </ScreenBody>
    </Screen>
  );
}

function Avantages({ formule }: { formule: keyof typeof FORMULES }) {
  return (
    <ul className="flex flex-col gap-1">
      {FORMULES[formule].avantages.map((a) => (
        <li key={a} className="flex items-start gap-2 text-sm">
          <Check size={16} className="mt-0.5 shrink-0 text-success" aria-hidden />
          {a}
        </li>
      ))}
    </ul>
  );
}

function LigneAbonnement({ a, moyens }: { a: AbonnementCommercant; moyens: MoyenDePaiement[] }) {
  const etat = ETATS_ABONNEMENT[a.etat];
  return (
    <Card padded className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={etat.ton}>{etat.libelle}</Badge>
        <BadgeFormule formule={a.formule} />
        <span className="text-sm font-semibold">
          {a.offertParLEquipe && !a.prixGnf ? "Offert par Filloo" : a.prixGnf ? formatGnf(a.prixGnf) : "Gratuit"}
        </span>
      </div>
      {a.debutAt && a.finAt ? (
        <p className="text-2xs text-ink-soft">
          Du {jour(a.debutAt)} au {jour(a.finAt)}
        </p>
      ) : null}
      {a.etat === "a_payer" ? (
        <BlocPaiement montant={a.prixGnf} moyens={moyens} action={declarerPaiementAbonnementAction} champ="abonnement" id={a.id} />
      ) : null}
      {a.etat === "en_attente" && a.paiementReference ? (
        <p className="text-sm text-ink-soft">
          Paiement déclaré ({a.paiementMoyen ? MOYENS_PAIEMENT[a.paiementMoyen] : ""}, réf. {a.paiementReference}) : l&apos;équipe le
          vérifie.
        </p>
      ) : null}
      {a.motif && (a.etat === "refusee" || a.etat === "interrompue") ? <p className="text-sm text-danger">Motif : {a.motif}</p> : null}
      {a.aRembourser ? <p className="text-sm text-ink-soft">L&apos;équipe Filloo va vous rembourser.</p> : null}
      {a.rembourseAt ? <p className="text-sm text-ink-soft">Remboursé le {jour(a.rembourseAt)}.</p> : null}
      {a.etat === "a_payer" || a.etat === "en_attente" ? (
        <form action={annulerAbonnementAction}>
          <input type="hidden" name="abonnement" value={a.id} />
          <PendingSubmit className="text-sm font-semibold text-danger">Annuler cette demande</PendingSubmit>
        </form>
      ) : null}
    </Card>
  );
}
