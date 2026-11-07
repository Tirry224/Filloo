import Link from "next/link";
import { Coins } from "lucide-react";
import { ETATS_ABONNEMENT } from "@/components/abonnement/AbonnementVue";
import { AdminTopBar, EnTeteOnglet } from "@/components/admin/AdminTopBar";
import { jourEtHeure } from "@/components/admin/EtatAnnonce";
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
import { corrigerCreditsAction, deciderAchatCreditsAction, marquerAchatCreditsRembourseAction } from "@/lib/actions/credits";
import { credits, type AchatCreditsEquipe, type SoldeBoutique } from "@/lib/data/credits";
import { MOYENS_PAIEMENT, lireMoyen, type BoutiqueChoisie, type RevenuDuMois } from "@/lib/data/publicite";
import { formatGnf } from "@/lib/format";

const SECTIONS = [
  { titre: "Paiement à vérifier", garde: (a: AchatCreditsEquipe) => a.etat === "en_attente" },
  { titre: "À rembourser", garde: (a: AchatCreditsEquipe) => a.aRembourser },
  { titre: "En attente du paiement", garde: (a: AchatCreditsEquipe) => a.etat === "a_payer" },
  { titre: "Passés", garde: () => true },
] as const;
const sectionDe = (a: AchatCreditsEquipe) => SECTIONS.find((s) => s.garde(a))!.titre;

const BOUTON = "flex h-tap w-full cursor-pointer items-center justify-center rounded-lg text-base font-semibold";

/**
 * Les crédits vus par l'équipe (0060) : les achats à vérifier, les soldes
 * des boutiques, et la correction à la main (offrir ou retirer, toujours
 * avec un motif signé dans l'historique).
 */
export function CreditsAdminVue({
  achats,
  soldes,
  revenus,
  boutiques,
  erreur,
  info,
}: {
  achats: AchatCreditsEquipe[];
  soldes: SoldeBoutique[];
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
          <EnTeteOnglet titre="Ventes" sousTitre="Crédits de publicité : 1 crédit = 1 000 GNF, packs de 10, 25 et 50." />
          <OngletsVentes actif="credits" />
          {erreur ? <Notice>{erreur}</Notice> : null}
          {info ? <Notice tone="success">{info}</Notice> : null}
          <Revenus revenus={revenus} />
          <Link href="/admin/publicite/tarifs" className="text-sm font-semibold underline">
            Crédits inclus dans Business, prix et numéros de paiement
          </Link>

          <details className="rounded-lg border border-line bg-surface p-4">
            <summary className="cursor-pointer text-base font-bold">Offrir ou retirer des crédits</summary>
            <form action={corrigerCreditsAction} className="mt-3 flex flex-col gap-3">
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
              <Field label="Crédits" htmlFor="credits" hint="Négatif pour en retirer. Offerts : valables 12 mois.">
                <Input id="credits" name="credits" inputMode="numeric" required />
              </Field>
              <Field label="Motif" htmlFor="motif" hint="Montré au commerçant dans son historique.">
                <Input id="motif" name="motif" required minLength={3} maxLength={500} />
              </Field>
              <PendingSubmit className={`${BOUTON} bg-accent text-on-accent`}>Enregistrer</PendingSubmit>
            </form>
          </details>

          {soldes.length ? (
            <div className="flex flex-col gap-2.5">
              <SectionLabel>Soldes des boutiques</SectionLabel>
              <Card className="divide-y divide-line">
                {soldes.map((s) => (
                  <div key={s.merchantId} className="flex items-center justify-between gap-3 px-3.5 py-2.5 text-sm">
                    <span className="truncate font-semibold">{s.nom}</span>
                    <span className="shrink-0 tabular-nums">{credits(s.disponibles)}</span>
                  </div>
                ))}
              </Card>
            </div>
          ) : null}

          {achats.length === 0 ? (
            <EmptyState icon={Coins} title="Aucun achat" description="Les achats de crédits des commerçants apparaîtront ici." />
          ) : (
            SECTIONS.map(({ titre }) => {
              const liste = achats.filter((a) => sectionDe(a) === titre);
              if (!liste.length) return null;
              return (
                <div key={titre} className="flex flex-col gap-2.5">
                  <SectionLabel>
                    {titre} · {liste.length}
                  </SectionLabel>
                  {liste.map((a) => (
                    <LigneAchat key={a.id} a={a} />
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

function LigneAchat({ a }: { a: AchatCreditsEquipe }) {
  const moyen = lireMoyen(a.paiement_moyen);
  const etat = ETATS_ABONNEMENT[a.etat];
  return (
    <Card padded className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={etat.ton}>{a.etat === "active" ? "Crédités" : etat.libelle}</Badge>
        <span className="text-2xs text-ink-soft">demandé le {jourEtHeure(a.created_at)}</span>
      </div>
      <Link href={`/boutique/${a.merchant_id}`} target="_blank" className="text-base font-semibold">
        {a.shop_name}
      </Link>
      <div className="flex flex-col gap-0.5 rounded-lg bg-paper px-3 py-2 text-sm">
        <span className="font-semibold">
          {credits(a.credits)} · {formatGnf(a.prix_gnf)}
        </span>
        {moyen ? (
          <span>
            {MOYENS_PAIEMENT[moyen]}
            {a.paiement_numero ? ` · depuis le ${a.paiement_numero}` : ""}
            {a.paiement_reference ? ` · réf. ${a.paiement_reference}` : ""}
          </span>
        ) : (
          <span className="text-ink-soft">Paiement pas encore déclaré</span>
        )}
        {a.rembourse_at ? <span className="text-2xs text-ink-soft">Remboursé le {jourEtHeure(a.rembourse_at)}</span> : null}
      </div>
      {a.motif ? <p className="text-sm text-ink-soft">Motif : {a.motif}</p> : null}

      {a.aRembourser ? (
        <form action={marquerAchatCreditsRembourseAction} className="border-t border-line pt-2.5">
          <input type="hidden" name="achat" value={a.id} />
          <PendingSubmit className={`${BOUTON} border border-line bg-surface`}>Remboursement fait</PendingSubmit>
        </form>
      ) : null}

      {a.etat === "en_attente" || a.etat === "a_payer" ? (
        <form action={deciderAchatCreditsAction} className="flex flex-col gap-2 border-t border-line pt-2.5">
          <input type="hidden" name="achat" value={a.id} />
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
                Paiement reçu, créditer
              </button>
            ) : null}
            <button type="submit" name="decision" value="refuser" className={`${BOUTON} border border-line bg-surface text-danger`}>
              Refuser
            </button>
          </div>
        </form>
      ) : null}
    </Card>
  );
}
