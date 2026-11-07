import { Coins } from "lucide-react";
import { jour } from "@/components/admin/EtatAnnonce";
import { ETATS_ABONNEMENT } from "@/components/abonnement/AbonnementVue";
import { BlocPaiement } from "@/components/publicite/BlocPaiement";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Notice } from "@/components/ui/Notice";
import { PendingSubmit } from "@/components/ui/PendingSubmit";
import { Screen, ScreenBody, Section } from "@/components/ui/Screen";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { TopBar } from "@/components/ui/TopBar";
import { annulerAchatCreditsAction, declarerPaiementCreditsAction, demanderCreditsAction } from "@/lib/actions/credits";
import {
  GNF_PAR_CREDIT,
  PACKS,
  credits,
  type AchatCredits,
  type LotCredits,
  type MesCredits,
} from "@/lib/data/credits";
import { MOYENS_PAIEMENT, type MoyenDePaiement } from "@/lib/data/publicite";
import { formatGnf } from "@/lib/format";

const ORIGINES: Record<LotCredits["origine"], string> = {
  achat: "Achat",
  abonnement: "Inclus dans Business",
  equipe: "Offerts par Filloo",
};

/**
 * « Mes crédits » (0050) : le solde, ce qui expire bientôt, l'achat d'un
 * pack (même paiement que le reste), et d'où vient chaque crédit.
 */
export function CreditsVue({
  solde,
  lots,
  achats,
  moyens,
  erreur,
  info,
}: {
  solde: MesCredits;
  lots: LotCredits[];
  achats: AchatCredits[];
  moyens: MoyenDePaiement[];
  erreur?: string;
  info?: string;
}) {
  const enCours = achats.find((a) => a.etat === "a_payer" || a.etat === "en_attente");
  const maintenant = Date.now();
  return (
    <Screen largeur="rangees">
      <TopBar backHref="/vendeur/publicite" title="Mes crédits" />
      <ScreenBody>
        <Section className="gap-5">
          {erreur ? <Notice>{erreur}</Notice> : null}
          {info ? <Notice tone="success">{info}</Notice> : null}

          <Card padded className="flex flex-col gap-1">
            <span className="font-display text-3xl font-bold tabular-nums">{credits(solde.disponibles)}</span>
            <span className="text-sm text-ink-soft">
              disponibles · 1 crédit = {formatGnf(GNF_PAR_CREDIT)} de publicité
            </span>
            {solde.expirentSous30Jours > 0 && solde.prochaineExpiration ? (
              <span className="text-sm text-danger">
                {credits(solde.expirentSous30Jours)} expirent bientôt (prochaine date : {jour(solde.prochaineExpiration)}).
              </span>
            ) : null}
          </Card>

          {enCours ? (
            <LigneAchat a={enCours} moyens={moyens} />
          ) : (
            <div className="flex flex-col gap-2.5">
              <SectionLabel>Acheter des crédits</SectionLabel>
              <p className="text-sm text-ink-soft">Valables 12 mois.</p>
              <div className="grid grid-cols-3 gap-2.5">
                {PACKS.map((p) => (
                  <form key={p} action={demanderCreditsAction}>
                    <input type="hidden" name="pack" value={p} />
                    <PendingSubmit className="flex h-full w-full cursor-pointer flex-col items-center gap-0.5 rounded-lg border border-line bg-surface px-2 py-3">
                      <span className="text-lg font-bold">{p}</span>
                      <span className="text-2xs text-ink-soft">crédits</span>
                      <span className="text-xs font-semibold">{formatGnf(p * GNF_PAR_CREDIT)}</span>
                    </PendingSubmit>
                  </form>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-col gap-2.5">
            <SectionLabel>D&apos;où viennent vos crédits</SectionLabel>
            {lots.length === 0 ? (
              <EmptyState icon={Coins} title="Aucun crédit" description="Vos achats, et les crédits inclus dans Business, apparaîtront ici." />
            ) : (
              <Card className="divide-y divide-line">
                {lots.map((l) => {
                  const expire = new Date(l.expireAt).getTime() <= maintenant;
                  return (
                    <div key={l.id} className="flex items-center justify-between gap-3 px-3.5 py-2.5 text-sm">
                      <span className="flex min-w-0 flex-col">
                        <span className="font-semibold">{ORIGINES[l.origine]}</span>
                        <span className="truncate text-2xs text-ink-soft">
                          {expire ? `Expiré le ${jour(l.expireAt)}` : `Jusqu'au ${jour(l.expireAt)}`}
                          {l.motif ? ` · ${l.motif}` : ""}
                        </span>
                      </span>
                      <span className={expire ? "shrink-0 text-ink-soft line-through tabular-nums" : "shrink-0 tabular-nums"}>
                        {l.restants} / {l.initiaux}
                      </span>
                    </div>
                  );
                })}
              </Card>
            )}
          </div>

          {achats.filter((a) => a !== enCours).length ? (
            <div className="flex flex-col gap-2.5">
              <SectionLabel>Mes achats</SectionLabel>
              {achats
                .filter((a) => a !== enCours)
                .map((a) => (
                  <LigneAchat key={a.id} a={a} moyens={moyens} />
                ))}
            </div>
          ) : null}
        </Section>
      </ScreenBody>
    </Screen>
  );
}

function LigneAchat({ a, moyens }: { a: AchatCredits; moyens: MoyenDePaiement[] }) {
  const etat = ETATS_ABONNEMENT[a.etat];
  return (
    <Card padded className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={etat.ton}>{a.etat === "active" ? "Crédités" : etat.libelle}</Badge>
        <span className="text-sm font-semibold">
          {credits(a.credits)} · {formatGnf(a.prixGnf)}
        </span>
      </div>
      <p className="text-2xs text-ink-soft">Demandé le {jour(a.creeAt)}</p>
      {a.etat === "a_payer" ? (
        <BlocPaiement montant={a.prixGnf} moyens={moyens} action={declarerPaiementCreditsAction} champ="achat" id={a.id} />
      ) : null}
      {a.etat === "en_attente" && a.paiementReference ? (
        <p className="text-sm text-ink-soft">
          Paiement déclaré ({a.paiementMoyen ? MOYENS_PAIEMENT[a.paiementMoyen] : ""}, réf. {a.paiementReference}) : l&apos;équipe le
          vérifie.
        </p>
      ) : null}
      {a.motif && a.etat === "refusee" ? <p className="text-sm text-danger">Motif : {a.motif}</p> : null}
      {a.aRembourser ? <p className="text-sm text-ink-soft">L&apos;équipe Filloo va vous rembourser.</p> : null}
      {a.rembourseAt ? <p className="text-sm text-ink-soft">Remboursé le {jour(a.rembourseAt)}.</p> : null}
      {a.etat === "a_payer" || a.etat === "en_attente" ? (
        <form action={annulerAchatCreditsAction}>
          <input type="hidden" name="achat" value={a.id} />
          <PendingSubmit className="text-sm font-semibold text-danger">Annuler cette demande</PendingSubmit>
        </form>
      ) : null}
    </Card>
  );
}
