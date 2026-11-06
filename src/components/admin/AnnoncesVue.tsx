import Link from "next/link";
import { CalendarClock, ChevronRight, FileText, Megaphone, Send } from "lucide-react";
import { AdminTopBar, EnTeteOnglet } from "@/components/admin/AdminTopBar";
import { EtatAnnonce, demain, jour } from "@/components/admin/EtatAnnonce";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field, Input, Textarea } from "@/components/ui/Field";
import { Notice } from "@/components/ui/Notice";
import { ScreenBody, Section, TabScreen } from "@/components/ui/Screen";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { creerAnnonceAction } from "@/lib/actions/equipe";
import { PUBLICS, type AnnonceAdmin } from "@/lib/data/equipe";

/** Les choix du formulaire : un mot chacun, la précision dessous. */
export const CHOIX_PUBLIC = {
  tous: { libelle: "Tous", aide: "Clients et commerçants" },
  clients: { libelle: "Clients", aide: "Comptes clients" },
  commercants: { libelle: "Commerçants", aide: "Comptes boutique" },
} as const;

const SECTIONS = [
  { etat: "brouillon", titre: "Brouillons" },
  { etat: "programmee", titre: "Programmées" },
  { etat: "publiee", titre: "Publiées" },
  { etat: "retiree", titre: "Retirées" },
] as const;

/**
 * Les annonces de l'équipe (0045) : une nouvelle annonce se publie tout de
 * suite, s'enregistre en brouillon ou se programme pour un jour ; chaque
 * annonce s'ouvre pour être modifiée, publiée, retirée, et pour voir qui
 * l'a lue.
 */
export function AnnoncesVue({ annonces, erreur, info }: { annonces: AnnonceAdmin[]; erreur?: string; info?: string }) {
  return (
    <TabScreen largeur="rangees">
      <AdminTopBar />
      <ScreenBody>
        <Section className="gap-5">
          <EnTeteOnglet
            titre="Annonces"
            sousTitre="Un message de l'équipe à tous, aux clients ou aux commerçants, avec une notification."
          />
          {erreur ? <Notice>{erreur}</Notice> : null}
          {info ? <Notice tone="success">{info}</Notice> : null}

          <Card padded>
            <form action={creerAnnonceAction} className="flex flex-col gap-4">
              <h2 className="text-base font-bold">Nouvelle annonce</h2>
              <Field label="Titre" htmlFor="titre" hint="C'est lui qui s'affiche dans la notification.">
                <Input id="titre" name="titre" maxLength={80} required placeholder="Ex. : Nouvelle catégorie Beauté" />
              </Field>
              <Field label="Message" htmlFor="corps">
                <Textarea id="corps" name="corps" rows={5} maxLength={2000} required placeholder="Ce que vous voulez dire…" />
              </Field>
              <ChoixPublic />
              <div className="flex flex-col gap-2.5 border-t border-line pt-4">
                <button
                  type="submit"
                  name="mode"
                  value="publier"
                  className="flex h-control w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-accent text-base font-semibold text-on-accent"
                >
                  <Send size={18} strokeWidth={2} aria-hidden />
                  Publier maintenant
                </button>
                <button
                  type="submit"
                  name="mode"
                  value="brouillon"
                  className="flex h-tap w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-line bg-surface text-base font-semibold text-ink"
                >
                  <FileText size={18} strokeWidth={2} aria-hidden />
                  Enregistrer en brouillon
                </button>
                <div className="flex items-stretch gap-2">
                  <label className="sr-only" htmlFor="date">
                    Date de publication
                  </label>
                  <input
                    id="date"
                    name="date"
                    type="date"
                    min={demain()}
                    defaultValue={demain()}
                    className="h-tap min-w-0 flex-1 rounded-lg border border-line bg-surface px-3 text-base"
                  />
                  <button
                    type="submit"
                    name="mode"
                    value="programmer"
                    className="flex h-tap shrink-0 cursor-pointer items-center justify-center gap-2 rounded-lg border border-line bg-surface px-3.5 text-base font-semibold text-ink"
                  >
                    <CalendarClock size={18} strokeWidth={2} aria-hidden />
                    Programmer
                  </button>
                </div>
                <p className="text-xs text-ink-soft">
                  Une annonce programmée part le matin du jour choisi, vers 7 h (heure de Conakry). Seules les personnes
                  inscrites à ce moment-là la reçoivent.
                </p>
              </div>
            </form>
          </Card>

          {annonces.length === 0 ? (
            <EmptyState
              icon={Megaphone}
              title="Aucune annonce"
              description="Les brouillons, annonces programmées et publiées apparaîtront ici."
            />
          ) : (
            SECTIONS.map(({ etat, titre }) => {
              const liste = annonces.filter((a) => a.etat === etat);
              if (!liste.length) return null;
              return (
                <div key={etat} className="flex flex-col gap-2.5">
                  <SectionLabel>
                    {titre} · {liste.length}
                  </SectionLabel>
                  {liste.map((a) => (
                    <LigneAnnonce key={a.id} annonce={a} />
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

/** Les trois publics, en cases à choisir. `fige` : une annonce publiée ne change plus de public. */
export function ChoixPublic({ valeur = "tous", fige = false }: { valeur?: keyof typeof CHOIX_PUBLIC; fige?: boolean }) {
  return (
    <fieldset className="flex flex-col gap-1.5" disabled={fige}>
      <legend className="mb-1.5 text-sm font-semibold text-ink-soft">Destinataires</legend>
      <div className="grid grid-cols-3 gap-2">
        {Object.entries(CHOIX_PUBLIC).map(([cle, { libelle, aide }]) => (
          <label key={cle} className={fige ? "cursor-not-allowed opacity-60" : "cursor-pointer"}>
            <input type="radio" name="public" value={cle} defaultChecked={cle === valeur} className="peer sr-only" />
            <span className="flex h-full flex-col gap-0.5 rounded-lg border border-line bg-surface px-2.5 py-2.5 peer-checked:border-accent peer-checked:bg-accent-soft peer-focus-visible:shadow-focus">
              <span className="text-sm font-semibold">{libelle}</span>
              <span className="text-2xs text-ink-soft">{aide}</span>
            </span>
          </label>
        ))}
      </div>
      {fige ? <p className="text-xs text-ink-soft">Publiée : ses destinataires sont figés.</p> : null}
    </fieldset>
  );
}

function LigneAnnonce({ annonce: a }: { annonce: AnnonceAdmin }) {
  const part = a.destinataires ? Math.round((a.lues / a.destinataires) * 100) : 0;
  return (
    <Link href={`/admin/annonces/${a.id}`}>
      <Card className="flex items-center gap-3 p-3.5">
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <EtatAnnonce etat={a.etat} />
            <span className="text-2xs font-medium text-ink-soft">{PUBLICS[a.public]}</span>
          </div>
          <span className="truncate text-base font-semibold">{a.titre}</span>
          <p className="line-clamp-2 text-sm text-ink-soft">{a.corps}</p>
          <p className="text-2xs text-ink-soft">
            {a.etat === "programmee" && a.programmeePour
              ? `Part le ${jour(a.programmeePour)} vers 7 h`
              : a.etat === "brouillon"
                ? `Créé le ${jour(a.creeeAt)}${a.auteur ? ` par ${a.auteur}` : ""}`
                : `Lue par ${a.lues} sur ${a.destinataires} · ${part} %${a.modifieeAt ? " · modifiée" : ""}`}
          </p>
          {a.etat === "publiee" ? (
            <div className="h-1 overflow-hidden rounded-full bg-paper" aria-hidden>
              <div className="h-full rounded-full bg-accent" style={{ width: `${part}%` }} />
            </div>
          ) : null}
        </div>
        <ChevronRight size={18} strokeWidth={2} className="shrink-0 text-ink-soft" aria-hidden />
      </Card>
    </Link>
  );
}
