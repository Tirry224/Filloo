import Link from "next/link";
import { Plus, Tags, TrendingUp } from "lucide-react";
import { AdminTopBar, EnTeteOnglet } from "@/components/admin/AdminTopBar";
import { OngletsVentes } from "@/components/admin/OngletsVentes";
import { jour, jourEtHeure } from "@/components/admin/EtatAnnonce";
import { EtatCampagne, tauxDeClics } from "@/components/publicite/EtatCampagne";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Notice } from "@/components/ui/Notice";
import { PendingSubmit } from "@/components/ui/PendingSubmit";
import { ScreenBody, Section, TabScreen } from "@/components/ui/Screen";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { deciderCampagneAction, interrompreCampagneAction, marquerRembourseAction } from "@/lib/actions/publicite";
import {
  MOYENS_PAIEMENT,
  TYPES_CAMPAGNE,
  lireMoyen,
  type CampagneEquipe,
  type RevenuDuMois,
  type TypeCampagne,
} from "@/lib/data/publicite";
import { formatGnf } from "@/lib/format";

/* Une campagne n'apparaît que dans UNE section : la première qui la garde. */
const SECTIONS = [
  { titre: "Paiement à vérifier", garde: (c: CampagneEquipe) => c.etat === "en_attente" },
  { titre: "À rembourser", garde: (c: CampagneEquipe) => c.aRembourser },
  { titre: "En attente du paiement", garde: (c: CampagneEquipe) => c.etat === "a_payer" },
  { titre: "En ligne", garde: (c: CampagneEquipe) => c.etat === "active" },
  { titre: "Passées", garde: () => true },
] as const;

function sectionDe(c: CampagneEquipe): string {
  return SECTIONS.find((s) => s.garde(c))!.titre;
}

/**
 * La publicité vue par l'équipe (0047) : chaque demande se valide ou se
 * refuse (motif montré au commerçant), une campagne en ligne s'interrompt.
 * Chaque décision est signée dans l'historique de l'équipe.
 */
export function PubliciteAdminVue({
  campagnes,
  revenus,
  erreur,
  info,
}: {
  campagnes: CampagneEquipe[];
  revenus: RevenuDuMois[];
  erreur?: string;
  info?: string;
}) {
  return (
    <TabScreen largeur="rangees">
      <AdminTopBar />
      <ScreenBody>
        <Section className="gap-5">
          <EnTeteOnglet
            titre="Ventes"
            sousTitre="Le commerçant paie par Orange Money ou MTN MoMo, l'équipe vérifie avant la mise en ligne."
          />
          <OngletsVentes actif="publicite" />
          {erreur ? <Notice>{erreur}</Notice> : null}
          {info ? <Notice tone="success">{info}</Notice> : null}
          <div className="grid grid-cols-2 gap-2">
            <Link href="/admin/publicite/nouvelle" className="flex h-tap items-center justify-center gap-1.5 rounded-lg bg-accent text-sm font-semibold text-on-accent">
              <Plus size={16} aria-hidden /> Nouvelle publicité
            </Link>
            <Link href="/admin/publicite/tarifs" className="flex h-tap items-center justify-center gap-1.5 rounded-lg border border-line bg-surface text-sm font-semibold">
              <Tags size={16} aria-hidden /> Prix et paiement
            </Link>
          </div>
          <Revenus revenus={revenus} />
          {campagnes.length === 0 ? (
            <EmptyState icon={TrendingUp} title="Aucune demande" description="Les demandes de publicité des commerçants apparaîtront ici." />
          ) : (
            SECTIONS.map(({ titre, garde }) => {
              const liste = campagnes.filter((c) => garde(c) && sectionDe(c) === titre);
              if (!liste.length) return null;
              return (
                <div key={titre} className="flex flex-col gap-2.5">
                  <SectionLabel>
                    {titre} · {liste.length}
                  </SectionLabel>
                  {liste.map((c) => (
                    <LigneCampagne key={c.id} c={c} />
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

function LigneCampagne({ c }: { c: CampagneEquipe }) {
  return (
    <Card padded className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <EtatCampagne etat={c.etat} />
        <span className="text-2xs text-ink-soft">
          {TYPES_CAMPAGNE[c.type as TypeCampagne]?.libelle ?? c.type} · {c.duree_jours} jours · demandée le{" "}
          {jourEtHeure(c.created_at)}
        </span>
      </div>
      <Link href={`/boutique/${c.merchant_id}`} target="_blank" className="text-base font-semibold">
        {c.shop_name}
      </Link>
      {c.type !== "boutique" ? (
        <p className="text-sm">
          {c.product_id ? (
            <Link href={`/produit/${c.product_id}`} target="_blank" className="underline">
              {c.produit_titre ?? "Produit"}
            </Link>
          ) : (
            "Produit supprimé"
          )}
          {c.category_name ? ` · ${c.category_name}` : ""}
        </p>
      ) : null}
      {c.etat === "active" && c.fin_at ? <p className="text-2xs text-ink-soft">Jusqu&apos;au {jour(c.fin_at)}</p> : null}
      <Paiement c={c} />
      {c.motif ? <p className="text-sm text-ink-soft">Motif : {c.motif}</p> : null}
      {c.debut_at ? (
        <p className="text-sm text-ink-soft">
          {c.vues} affichages · {c.clics} clics · {tauxDeClics(c.vues, c.clics)} · {c.contacts} contacts en 5 jours
        </p>
      ) : null}

      {c.aRembourser ? (
        <form action={marquerRembourseAction} className="border-t border-line pt-2.5">
          <input type="hidden" name="campagne" value={c.id} />
          <PendingSubmit className="flex h-tap w-full cursor-pointer items-center justify-center rounded-lg border border-line bg-surface text-base font-semibold">
            Remboursement fait
          </PendingSubmit>
        </form>
      ) : null}

      {c.etat === "en_attente" || c.etat === "a_payer" ? (
        <form action={deciderCampagneAction} className="flex flex-col gap-2 border-t border-line pt-2.5">
          <input type="hidden" name="campagne" value={c.id} />
          <input
            name="motif"
            maxLength={500}
            aria-label="Motif du refus"
            placeholder="Motif du refus (obligatoire pour refuser)"
            className="h-tap rounded-lg border border-line bg-surface px-3.5 text-base"
          />
          <div className={c.etat === "en_attente" ? "grid grid-cols-2 gap-2" : "grid grid-cols-1"}>
            {c.etat === "en_attente" ? (
              <button
                type="submit"
                name="decision"
                value="accepter"
                className="flex h-tap cursor-pointer items-center justify-center rounded-lg bg-accent text-base font-semibold text-on-accent"
              >
                {(c.prix_gnf ?? 0) > 0 && c.paiement_moyen !== "credits" ? "Paiement reçu, valider" : "Valider"}
              </button>
            ) : null}
            <button
              type="submit"
              name="decision"
              value="refuser"
              className="flex h-tap cursor-pointer items-center justify-center rounded-lg border border-line bg-surface text-base font-semibold text-danger"
            >
              Refuser
            </button>
          </div>
        </form>
      ) : null}

      {c.etat === "active" ? (
        <details className="border-t border-line pt-2.5">
          <summary className="cursor-pointer text-sm font-semibold text-danger">Interrompre</summary>
          <form action={interrompreCampagneAction} className="mt-2 flex flex-col gap-2">
            <input type="hidden" name="campagne" value={c.id} />
            <input
              name="motif"
              required
              minLength={3}
              maxLength={500}
              aria-label="Motif de l'interruption"
              placeholder="Motif, montré au commerçant"
              className="h-tap rounded-lg border border-line bg-surface px-3.5 text-base"
            />
            <PendingSubmit className="flex h-tap w-full cursor-pointer items-center justify-center rounded-lg border border-line bg-surface text-base font-semibold text-danger">
              Interrompre la campagne
            </PendingSubmit>
          </form>
        </details>
      ) : null}
    </Card>
  );
}

/** Ce qui a été payé, comment, et la référence à chercher dans le relevé Orange Money ou MTN. */
export function Paiement({ c }: { c: CampagneEquipe }) {
  const moyen = lireMoyen(c.paiement_moyen);
  if (c.prix_gnf === null) return null;
  return (
    <div className="flex flex-col gap-0.5 rounded-lg bg-paper px-3 py-2 text-sm">
      <span className="font-semibold">
        {c.prix_gnf === 0 ? "Gratuite" : formatGnf(c.prix_gnf)}
        {c.creee_par_equipe ? " · créée par l'équipe" : ""}
      </span>
      {moyen ? (
        <span>
          {MOYENS_PAIEMENT[moyen]}
          {c.paiement_numero ? ` · depuis le ${c.paiement_numero}` : ""}
          {c.paiement_reference ? ` · réf. ${c.paiement_reference}` : ""}
        </span>
      ) : c.prix_gnf > 0 ? (
        <span className="text-ink-soft">Paiement pas encore déclaré</span>
      ) : null}
      {c.paiement_declare_at && !c.paiement_confirme_at ? (
        <span className="text-2xs text-ink-soft">Déclaré le {jourEtHeure(c.paiement_declare_at)}, à vérifier</span>
      ) : null}
      {c.paiement_confirme_at ? <span className="text-2xs text-ink-soft">Vérifié le {jourEtHeure(c.paiement_confirme_at)}</span> : null}
      {c.rembourse_at ? <span className="text-2xs text-ink-soft">Remboursé le {jourEtHeure(c.rembourse_at)}</span> : null}
    </div>
  );
}

/** Le mois en cours et le total : ce qui est réellement entré (vérifié, moins les remboursements). */
export function Revenus({ revenus }: { revenus: RevenuDuMois[] }) {
  const ceMois = new Date().toISOString().slice(0, 7);
  const mois = revenus.find((r) => r.mois.slice(0, 7) === ceMois);
  const total = revenus.reduce((s, r) => s + r.encaisse - r.rembourse, 0);
  return (
    <div className="grid grid-cols-2 gap-2 text-center">
      <div className="flex flex-col rounded-lg border border-line bg-surface px-2 py-3">
        <span className="text-base font-bold">{formatGnf((mois?.encaisse ?? 0) - (mois?.rembourse ?? 0))}</span>
        <span className="text-2xs text-ink-soft">encaissé ce mois</span>
      </div>
      <div className="flex flex-col rounded-lg border border-line bg-surface px-2 py-3">
        <span className="text-base font-bold">{formatGnf(total)}</span>
        <span className="text-2xs text-ink-soft">depuis le début</span>
      </div>
    </div>
  );
}
