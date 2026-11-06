import Link from "next/link";
import { TrendingUp } from "lucide-react";
import { AdminTopBar, EnTeteOnglet } from "@/components/admin/AdminTopBar";
import { jour, jourEtHeure } from "@/components/admin/EtatAnnonce";
import { EtatCampagne, tauxDeClics } from "@/components/publicite/EtatCampagne";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Notice } from "@/components/ui/Notice";
import { PendingSubmit } from "@/components/ui/PendingSubmit";
import { ScreenBody, Section, TabScreen } from "@/components/ui/Screen";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { deciderCampagneAction, interrompreCampagneAction } from "@/lib/actions/publicite";
import { TYPES_CAMPAGNE, type CampagneEquipe, type TypeCampagne } from "@/lib/data/publicite";

const SECTIONS = [
  { titre: "À valider", garde: (c: CampagneEquipe) => c.etat === "en_attente" },
  { titre: "En ligne", garde: (c: CampagneEquipe) => c.etat === "active" },
  { titre: "Passées", garde: (c: CampagneEquipe) => c.etat !== "en_attente" && c.etat !== "active" },
] as const;

/**
 * La publicité vue par l'équipe (0047) : chaque demande se valide ou se
 * refuse (motif montré au commerçant), une campagne en ligne s'interrompt.
 * Chaque décision est signée dans l'historique de l'équipe.
 */
export function PubliciteAdminVue({ campagnes, erreur, info }: { campagnes: CampagneEquipe[]; erreur?: string; info?: string }) {
  return (
    <TabScreen largeur="rangees">
      <AdminTopBar />
      <ScreenBody>
        <Section className="gap-5">
          <EnTeteOnglet
            titre="Publicité"
            sousTitre="Les demandes des commerçants. Gratuites tant que le paiement n'est pas en place."
          />
          {erreur ? <Notice>{erreur}</Notice> : null}
          {info ? <Notice tone="success">{info}</Notice> : null}
          {campagnes.length === 0 ? (
            <EmptyState icon={TrendingUp} title="Aucune demande" description="Les demandes de publicité des commerçants apparaîtront ici." />
          ) : (
            SECTIONS.map(({ titre, garde }) => {
              const liste = campagnes.filter(garde);
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
      {c.motif ? <p className="text-sm text-ink-soft">Motif : {c.motif}</p> : null}
      {c.debut_at ? (
        <p className="text-sm text-ink-soft">
          {c.vues} affichages · {c.clics} clics · {tauxDeClics(c.vues, c.clics)}
        </p>
      ) : null}

      {c.etat === "en_attente" ? (
        <form action={deciderCampagneAction} className="flex flex-col gap-2 border-t border-line pt-2.5">
          <input type="hidden" name="campagne" value={c.id} />
          <input
            name="motif"
            maxLength={500}
            aria-label="Motif du refus"
            placeholder="Motif du refus (obligatoire pour refuser)"
            className="h-tap rounded-lg border border-line bg-surface px-3.5 text-base"
          />
          <div className="grid grid-cols-2 gap-2">
            <button
              type="submit"
              name="decision"
              value="accepter"
              className="flex h-tap cursor-pointer items-center justify-center rounded-lg bg-accent text-base font-semibold text-on-accent"
            >
              Valider
            </button>
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
